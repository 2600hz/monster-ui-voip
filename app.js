define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var appSubmodules = [
		'callLogs',
		'devices',
		'featureCodes',
		'groups',
		'myOffice',
		'numbers',
		'strategy',
		'strategyHours',
		'strategyHolidays',
		'users',
		'vmboxes'
	];

	require(_.map(appSubmodules, function(name) {
		return './submodules/' + name + '/' + name;
	}));

	var app = {
		name: 'voip',

		css: [ 'app' ],

		i18n: {
			'de-DE': { customCss: false },
			'en-US': { customCss: false },
			'fr-FR': { customCss: false },
			'ru-RU': { customCss: false },
			'es-ES': { customCss: false },
			'fr-CA': { customCss: false }
		},

		requests: {},
		subscribe: {
			'core.crossSiteMessage.voip': 'crossSiteMessageHandler'
		},
		appFlags: {
			common: {
				hasProvisioner: false,
				outboundPrivacy: [
					'default',
					'none',
					'number',
					'name',
					'full'
				],
				callRecording: {
					supportedAudioFormats: [
						'mp3',
						'wav'
					],
					validationConfig: {
						rules: {
							time_limit: {
								digits: true,
								required: true
							},
							url: {
								protocols: [
									'http',
									'https',
									'ftp',
									'ftps',
									'sftp'
								],
								required: true
							}
						}
					}
				}
			},
			global: {},
			disableFirstUseWalkthrough: monster.config.whitelabel.disableFirstUseWalkthrough
		},

		subModules: appSubmodules,

		render: function(container) {
			var self = this,
				parent = container || $('#monster_content'),
				template = $(self.getTemplate({
					name: 'app'
				}));

			self.appFlags.common.hasProvisioner = _.isString(monster.config.api.provisioner);

			self.loadGlobalData(function() {
				/* On first Load, load my office */
				template.find('.category#myOffice').addClass('active');
				monster.pub('voip.myOffice.render', { parent: template.find('.right-content') });
			});

			self.bindEvents(template);

			parent
				.empty()
				.append(template);
		},

		formatData: function(data) {
			var self = this;
		},

		isExtensionDisplayable: function(number) {
			var isAlphanumericExtensionsEnabled = monster.util.isFeatureAvailable('smartpbx.users.settings.utfExtensions.show'),
				regex = /\D/,
				isAlphanumericExtension = regex.test(number);

			return isAlphanumericExtensionsEnabled || !isAlphanumericExtension;
		},

		loadGlobalData: function(callback) {
			var self = this;

			monster.parallel({
				servicePlansRole: function(callback) {
					if (monster.config.hasOwnProperty('resellerId') && monster.config.resellerId.length) {
						self.callApi({
							resource: 'services.listAvailable',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false,
									'filter_merge.strategy': 'cumulative'
								}
							},
							success: function(data, status) {
								var formattedData = _.keyBy(data.data, 'id');

								callback(null, formattedData);
							}
						});
					} else {
						callback(null, {});
					}
				}
			}, function(err, results) {
				self.appFlags.global.servicePlansRole = results.servicePlansRole;
				self.appFlags.global.showUserTypes = !_.isEmpty(results.servicePlansRole);

				callback && callback(self.appFlags.global);
			});
		},

		bindEvents: function(parent) {
			var self = this,
				container = parent.find('.right-content');

			parent.find('.left-menu').on('click', '.category:not(.loading)', function() {
				// Get the ID of the submodule to render
				var $this = $(this),
					args = {
						parent: container,
						callback: function() {
							parent.find('.category').removeClass('loading');
						}
					},
					id = $this.attr('id');

				// Display the category we clicked as active
				parent
					.find('.category')
					.removeClass('active')
					.addClass('loading');
				$this.toggleClass('active');

				// Empty the main container and then render the submodule content
				container.empty();
				monster.pub('voip.' + id + '.render', args);
			});
		},

		crossSiteMessageHandler: function(topic) {
			var crossSiteMessageTopic = topic.replace('.tab', '') + '.render',
				container = $('.right-content');

			monster.pub(crossSiteMessageTopic, { parent: container });
		},

		overlayInsert: function() {
			$('#monster_content')
				.append($('<div>', {
					id: 'voip_container_overlay'
				}));
		},

		overlayRemove: function() {
			$('#monster_content')
				.find('#voip_container_overlay')
					.remove();
		},

		/**
		 * @param  {jQuery} $template
		 * @param  {String} entityId
		 */
		overlayBindOnClick: function($template, entityId) {
			var self = this,
				editContainerClass = '.edit-' + entityId;

			$('#monster_content').on('click', '#voip_container_overlay', function() {
				$template.find(editContainerClass).slideUp('400', function() {
					$(this).empty();
				});

				self.overlayRemove();

				$template.find('.grid-cell.active').css({
					'z-index': '0'
				});

				$template.find('.grid-row.active').parent().siblings(editContainerClass).css({
					'z-index': '0'
				});

				$template
					.find('.grid-cell.active, .grid-row.active')
						.removeClass('active');
			});
		},

		patchCallflow: function(args) {
			var self = this;

			self.callApi({
				resource: 'callflow.patch',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Runs tasks necessary for mobile device callfow update on un\assignement.
		 * @param  {String|null} userId
		 * @param  {String|null|undefined} userMainCallflowId
		 * @param  {Object} device
		 * @param  {String} device.id
		 * @param  {String} device.mobile.mdn
		 * @param  {Function} mainCallback
		 *
		 * updateMobileCallflowAssignment(userId, userMainCallflowId|undefined, ...)
		 * this signature will assign the device
		 *
		 * updateMobileCallflowAssignment(null, null, ...)
		 * this signature will unassign the device
		 *
		 * While assigning, you can either provide the user's main callflow's ID or set it to
		 * `undefined`, in which case the method will take care of resolving it based on `userId`.
		 */
		updateMobileCallflowAssignment: function(userId, userMainCallflowId, device, mainCallback) {
			var self = this,
				getMainUserCallflowId = function getMainUserCallflowId(userId, callback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								filter_owner_id: userId,
								filter_type: 'mainUserCallflow'
							}
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.head,
							_.partial(_.get, _, 'id'),
							_.partial(callback, null)
						),
						error: _.partial(callback, true)
					});
				},
				maybeGetMainUserCallflowId = function maybeGetMainUserCallflowId(userId, userMainCallflowId, callback) {
					if (_.isNull(userMainCallflowId) || !_.isUndefined(userMainCallflowId)) {
						return callback(null, userMainCallflowId);
					}
					getMainUserCallflowId(userId, callback);
				},
				getMobileCallflowIdByNumber = function getMobileCallflowIdByNumber(number, callback) {
					self.callApi({
						resource: 'callflow.searchByNumber',
						data: {
							accountId: self.accountId,
							value: number
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.head,
							_.partial(_.get, _, 'id'),
							_.partial(callback, null)
						),
						error: _.partial(callback, true)
					});
				},
				getCallflowIds = function getCallflowIds(userId, userMainCallflowId, number, callback) {
					monster.parallel({
						userMainCallflowId: _.partial(maybeGetMainUserCallflowId, userId, userMainCallflowId),
						mobileCallflowId: _.partial(getMobileCallflowIdByNumber, number)
					}, callback);
				},
				updateMobileCallflowAssignment = function updateMobileCallflowAssignment(userId, deviceId, callflowIds, callback) {
					var userMainCallflowId = callflowIds.userMainCallflowId,
						mobileCallflowId = callflowIds.mobileCallflowId,
						updatedCallflow = _.merge({
							owner_id: userId
						}, _.isNull(userMainCallflowId) ? {
							flow: {
								module: 'device',
								data: {
									id: deviceId
								}
							}
						} : {
							flow: {
								module: 'callflow',
								data: {
									id: userMainCallflowId
								}
							}
						});

					self.patchCallflow({
						data: {
							callflowId: mobileCallflowId,
							data: updatedCallflow
						},
						success: _.partial(callback, null),
						error: _.partial(callback, true)
					});
				};

			monster.waterfall([
				_.partial(getCallflowIds, userId, userMainCallflowId, device.mobile.mdn),
				_.partial(updateMobileCallflowAssignment, userId, device.id)
			], mainCallback);
		},

		getOrCreateMainVMBox: function(callback) {
			var self = this,
				findMainVMBoxId = function(next) {
					self.callApi({
						resource: 'voicemail.list',
						data: {
							accountId: self.accountId,
							filters: {
								filter_type: 'mainVMBox'
							}
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.head,
							_.partial(_.get, _, 'id'),
							_.partial(next, null)
						),
						error: next
					});
				},
				maybeRetrieveVMBoxFromId = function(vmBoxId, next) {
					if (_.isUndefined(vmBoxId)) {
						return next(null, undefined);
					}
					self.callApi({
						resource: 'voicemail.get',
						data: {
							accountId: self.accountId,
							voicemailId: vmBoxId
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(next, null)
						),
						error: next
					});
				},
				maybeGetMainVMBox = function(next) {
					monster.waterfall([
						findMainVMBoxId,
						maybeRetrieveVMBoxFromId
					], next);
				},
				maybeCreateMainVMBox = function(mainVMBox, next) {
					if (_.isObject(mainVMBox)) {
						return next(null, mainVMBox);
					}
					self.callApi({
						resource: 'voicemail.create',
						data: {
							accountId: self.accountId,
							data: {
								type: 'mainVMBox',
								mailbox: '0',
								name: self.i18n.active().myOffice.mainVMBoxName,
								delete_after_notify: true
							}
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(next, null)
						),
						error: next
					});
				};

			monster.waterfall([
				maybeGetMainVMBox,
				maybeCreateMainVMBox
			], callback);
		}
	};

	return app;
});
