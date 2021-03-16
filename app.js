define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster');

	var overrideDestArray = function(dest, src) {
		return _.every([dest, src], _.isArray) ? src : undefined;
	};

	var appSubmodules = [
		'callLogs',
		'devices',
		'featureCodes',
		'groups',
		'myOffice',
		'numbers',
		'strategy',
		'strategyHours',
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
			'es-ES': { customCss: false }
		},

		requests: {},
		subscribe: {},
		appFlags: {
			common: {
				hasProvisioner: _.isString(monster.config.api.provisioner),
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
			global: {}
		},

		subModules: appSubmodules,

		load: function(callback) {
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container) {
			var self = this,
				parent = container || $('#monster_content'),
				template = $(self.getTemplate({
					name: 'app'
				}));

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

		/**
		 * @param  {Object} device
		 * @param  {String} device.device_type
		 * @param  {String} [device.id]
		 * @return {Object}
		 */
		applyDeviceDefaults: function(device) {
			var self = this;

			return _.mergeWith(
				self.getDeviceDefaults(device),
				device,
				overrideDestArray
			);
		},

		/**
		 * @param  {Object} device
		 * @param  {String} device.device_type
		 * @param  {String} [device.id]
		 * @return {Object}
		 */
		getDeviceDefaults: function(device) {
			var self = this,
				isNew = !_.has(device, 'id'),
				type = _.get(device, 'device_type');

			return _.mergeWith(
				isNew ? self.getDeviceBaseDefaults() : {},
				self.getDeviceDefaultsForType(type),
				overrideDestArray
			);
		},

		/**
		 * Returns common base config for devices
		 * @return {Object}
		 */
		getDeviceBaseDefaults: function() {
			return {
				call_restriction: {},
				device_type: 'sip_device',
				enabled: true,
				media: {
					audio: {
						codecs: []
					},
					encryption: {
						enforce_security: false
					},
					video: {
						codecs: []
					}
				},
				suppress_unregister_notifications: true
			};
		},

		/**
		 * Returns device type specific config
		 * @param  {String} type Device type
		 * @return {Object}
		 */
		getDeviceDefaultsForType: function(type) {
			var callForwardSettings = {
					call_forward: {
						require_keypress: true,
						keep_caller_id: true
					},
					contact_list: {
						exclude: true
					}
				},
				sipSettings = {
					sip: {
						password: monster.util.randomString(12),
						realm: monster.apps.auth.currentAccount.realm,
						username: 'user_' + monster.util.randomString(10)
					}
				},
				defaultsPerType = {
					ata: _.merge({}, sipSettings),
					cellphone: _.merge({}, callForwardSettings),
					fax: _.merge({
						media: {
							fax_option: 'false'
						},
						outbound_flags: [
							'fax'
						]
					}, sipSettings),
					landline: _.merge({}, callForwardSettings),
					mobile: _.merge({}, sipSettings),
					sip_device: _.merge({}, sipSettings),
					sip_uri: {
						sip: _.merge({
							expire_seconds: 360,
							invite_format: 'route',
							method: 'password'
						}, _.pick(sipSettings.sip, [
							'password',
							'username'
						]))
					},
					smartphone: _.merge({}, sipSettings, callForwardSettings),
					softphone: _.merge({}, sipSettings)
				};

			return _.get(defaultsPerType, type, {});
		}
	};

	return app;
});
