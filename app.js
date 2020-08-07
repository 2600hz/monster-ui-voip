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
				hasProvisioner: false,
				outboundPrivacy: [
					'default',
					'none',
					'number',
					'name',
					'full'
				]
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

			self.appFlags.common.hasProvisioner = _.isString(monster.config.api.provisioner);

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

		maybeUpdateMobileCallflow: function(userId, userMainCallflowId, device, mainCallback) {
			if (device.device_type !== 'mobile') {
				return mainCallback(null);
			}
			var self = this,
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
				patchCallflow = function patchCallflow(data, callflowId, callback) {
					self.callApi({
						resource: 'callflow.patch',
						data: {
							accountId: self.accountId,
							callflowId: callflowId,
							data: data
						},
						success: _.flow(
							_.partial(_.get, _, 'data'),
							_.partial(callback, null)
						),
						error: _.partial(callback, true)
					});
				},
				updatedCallflow = _.merge({
					owner_id: userId
				}, _.isUndefined(userMainCallflowId) ? {
					flow: {
						module: 'device',
						data: {
							id: device.id
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

			monster.waterfall([
				_.partial(getMobileCallflowIdByNumber, device.mobile.mdn),
				_.partial(patchCallflow, updatedCallflow)
			], mainCallback);
		}
	};

	return app;
});
