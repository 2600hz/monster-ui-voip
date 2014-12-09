define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		chart = require('chart');

	var app = {
		requests: {
		},

		subscribe: {
			'voip.featureCodes.render': 'featureCodesRender'
		},

		featureCodesRender: function(args) {
			var self = this,
				parent = args.parent || $('.right-content');

			self.featureCodesLoadData(function(featureCodesData) {
				var template = $(monster.template(self, 'featureCodes-layout', {featureCodes: featureCodesData}));

				self.featureCodesBindEvents({
					parent: parent,
					template: template,
					featureCodes: featureCodesData
				});

				parent
					.empty()
					.append(template);
			});
		},

		featureCodesLoadData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						'has_key': 'featurecode'
					}
				},
				success: function(data, status) {
					var featureCodes = $.map(data.data, function(callflow) {
						if(!_.isEmpty(callflow.featurecode)) {
							return {
								key: callflow.featurecode.name,
								name: self.i18n.active().featureCodes.labels[callflow.featurecode.name],
								number: callflow.featurecode.number.replace(/\\/g,'')
							};
						}
					});
					callback && callback(featureCodes);
				}
			});
		},

		featureCodesBindEvents: function(args) {
			var self = this,
				parent = args.parent,
				template = args.template,
				featureCodes = args.featureCodes;

			template.find('.main-number-link').on('click', function(e) {
				e.preventDefault();
				var leftMenu = parent.parents('#voip_container').find('.left-menu');

				leftMenu.find('.category')
						.removeClass('active');
				leftMenu.find('.category#strategy')
						.addClass('active');

				parent.empty();
				monster.pub('voip.strategy.render', {
					parent: parent
				});
			});
		}
	};

	return app;
});
