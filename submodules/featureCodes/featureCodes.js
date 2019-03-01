define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		chart = require('chart');

	var app = {
		requests: {
		},

		subscribe: {
			'voip.featureCodes.render': 'featureCodesRender'
		},

		categories: {
			qubicle: [
				'qubicle login',
				'qubicle set ready',
				'qubicle set away',
				'qubicle logout'
			],
			call_forward: [
				'call_forward[action=activate]',
				'call_forward[action=deactivate]',
				'call_forward[action=toggle]',
				'call_forward[action=update]',
				'call_forward[action=on_busy_enable]',
				'call_forward[action=on_busy_disable]',
				'call_forward[action=no_answer_enable]',
				'call_forward[action=no_answer_disable]'
			],
			hotdesk: [
				'hotdesk[action=login]',
				'hotdesk[action=logout]',
				'hotdesk[action=toggle]'
			],
			parking: [
				'park_and_retrieve',
				'valet',
				'retrieve'
			],
			do_not_disturb: [
				'donotdisturb[action="enable"]',
				'donotdisturb[action="disable"]',
				'donotdisturb[action="toggle"]'
			],
			misc: [
				'voicemail[action=check]',
				'voicemail[action="direct"]',
				'intercom',
				'privacy[mode=full]',
				'directory',
				'time',
				'call_waiting[action=enable]',
				'call_waiting[action=disable]',
				'sound_test_service',
				'call_recording',
				'move'
			]
		},

		featureCodesRender: function(args) {
			var self = this,
				parent = args.parent || $('.right-content'),
				callback = args.callback;

			self.featureCodesLoadData(function(featureCodesData) {
				var template = $(self.getTemplate({
					name: 'layout',
					data: {
						featureCodes: self.featureCodesFormatData(featureCodesData)
					},
					submodule: 'featureCodes'
				}));

				monster.ui.tooltips(template);

				self.featureCodesBindEvents({
					parent: parent,
					template: template,
					featureCodes: featureCodesData
				});

				parent
					.empty()
					.append(template);

				callback && callback();
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
					callback && callback(data.data);
				}
			});
		},

		featureCodesFormatData: function(featureCodeData) {
			var self = this,
				defaultCategories = _.map(self.categories, function(codecs, category) {
					return {
						key: category,
						items: codecs
					};
				});

			return _
				.chain(featureCodeData)
				.filter(function(callflow) {
					// Some old callflows have been created with the feature code key, so we check
					// to make sure they also have a name associated
					return _.has(callflow, 'featurecode.name');
				})
				.groupBy(function(callflow) {
					var string = callflow.featurecode.name.match(/^(\w+){1}/)[0],
						category = _.has(self.categories, string)
							? string
							: 'misc',
						defaultCategory = _.find(defaultCategories, function(category) {
							return _.includes(category.items, string);
						});

					return _.get(defaultCategory, 'key', category);
				})
				.map(function(codes, category) {
					return {
						label: self.i18n.active().featureCodes.categories[category],
						items: _
							.chain(codes)
							.map(function(code) {
								var i18n = _.get(self.i18n.active().featureCodes.labels, code.featurecode.name);

								return {
									hasStar: (
										!_.isEmpty(code.numbers)
										&& _.startsWith(code.numbers[0], '*')
									) || (
										!_.isEmpty(code.patterns)
										&& code.patterns[0].match(/^(\^?\\\*)/)
									),
									label: _.get(i18n, 'label', _.capitalize(code.featurecode.name)),
									number: _.has(code.featurecode, 'number')
										? _.replace(code.featurecode.number, /\\/g, '')
										: '',
									tooltip: _.get(i18n, 'tooltip')
								};
							})
							.sortBy(function(code) {
								var number = _.toNumber(code.number);

								return _.isNaN(number) ? -1 : number;
							})
							.value()
					};
				})
				.sortBy('label')
				.value();
		},

		featureCodesBindEvents: function(args) {
			var self = this,
				parent = args.parent,
				template = args.template;

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
