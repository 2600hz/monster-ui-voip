define(function(require) {
	var monster = require('monster'),
		_ = require('lodash'),
		$ = require('jquery'),
		timezone = require('monster-timezone');

	return {
		subscribe: {
			'voip.strategyHours.render': 'strategyHoursRender'
		},

		templatePresets: {
			nineToFiveWithNoonToOneLunchbreak: _
				.chain(5)
				.range()
				.map(function() {
					return [
						{ start: 3600 * 9, end: 3600 * 12, isOpen: true },
						{ start: 3600 * 12, end: 3600 * 13, isOpen: false },
						{ start: 3600 * 13, end: 3600 * 17, isOpen: true }
					];
				})
				.concat([[], []])
				.value()
		},

		strategyHoursRender: function(args) {
			var self = this,
				$container = args.container,
				strategyData = args.strategyData,
				callback = args.callback,
				intervals = [[], [], [], [], [], [], []],
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						alwaysOpen: _
							.chain(strategyData)
							.get('callflows.MainCallflow.flow.data.rules', [])
							.isEmpty()
							.value(),
						companyTimezone: timezone.formatTimezone(strategyData.callflows.MainCallflow.flow.data.timezone || monster.apps.auth.currentAccount.timezone)
					},
					submodule: 'strategyHours'
				}));

			$container
				.find('.element-content')
					.empty()
					.append(template);

			self.strategyHoursListingRender($container, intervals);
			self.strategyHoursBindEvents($container, template);

			callback && callback();
		},

		strategyHoursListingRender: function($container, intervals) {
			var self = this,
				days = self.weekdays,
				templateData = {
					isEmpty: _.every(intervals, _.isEmpty),
					templates: _.keys(self.templatePresets),
					days: _.map(days, function(day, index) {
						var label = monster.util.tryI18n(self.i18n.active().strategy.hours.days, day);

						return {
							id: day,
							abbreviation: label.slice(0, 3),
							label: label,
							intervals: intervals[index]
						};
					})
				},
				initTemplate = function initTemplate(data) {
					var $template = $(self.getTemplate({
						name: 'listing',
						data: data,
						submodule: 'strategyHours'
					}));

					_.forEach(data.days, function(day) {
						_.forEach(day.intervals, function(interval, index) {
							var $startPicker = $template.find('input[class*="' + day.id + '[' + index + '].start"]'),
								$endPicker = $template.find('input[class*="' + day.id + '[' + index + '].end"]'),
								intervals = day.intervals,
								previousBound = intervals[index - 1] ? intervals[index - 1].end : 0,
								nextBound = intervals[index + 1] ? intervals[index + 1].start : 86400;

							monster.ui.timepicker($startPicker, {
								useSelect: true,
								minTime: previousBound,
								maxTime: interval.end - (3600 / 2)
							});
							monster.ui.timepicker($endPicker, {
								useSelect: true,
								minTime: interval.start + (3600 / 2),
								maxTime: nextBound
							});
							$startPicker.timepicker('setTime', interval.start);
							$endPicker.timepicker('setTime', interval.end);
						});
					});

					self.strategyHoursListingBindEvents($container, $template);

					return $template;
				};

			$container
				.find('.office-hours-wrapper')
					.empty()
					.append(initTemplate(templateData));
		},

		strategyHoursBindEvents: function(parent, template, strategyData) {
			var self = this;

			template.on('change', '.custom-hours-toggler input[type="radio"]', function(e) {
				var toggleDiv = template.find('.custom-hours-div'),
					shouldOpen = $(this).val() === 'true',
					toggleMethod = shouldOpen ? 'slideDown' : 'slideUp';

				toggleDiv[toggleMethod](200);
			});

			template.on('click', '.add-hours', function(event) {
				event.preventDefault();

				monster.pub('voip.strategy.addOfficeHours', {
					existing: self.strategyHoursGetIntervalsFromTemplate(parent),
					callback: function(err, existing) {
						self.strategyHoursListingRender(parent, existing);
					}
				});
			});

			template.find('form').on('submit', function(event) {
				event.preventDefault();
			});

			// container.find('.save-button').on('click', function(e) {
			// 	e.preventDefault();

			// 	if (monster.ui.valid(container.find('#strategy_custom_hours_form'))) {
			// 		var parent = $(this).parents('.element-container'),
			// 			customHours = monster.ui.getFormData('strategy_custom_hours_form'),
			// 			mainCallflow = strategyData.callflows.MainCallflow,
			// 			formatChildModule = function(callflowId) {
			// 				return {
			// 					children: {},
			// 					data: {
			// 						id: callflowId
			// 					},
			// 					module: 'callflow'
			// 				};
			// 			};

			// 		_.each(strategyData.temporalRules.weekdays, function(val, key) {
			// 			delete mainCallflow.flow.children[val.id];
			// 		});
			// 		delete mainCallflow.flow.children[strategyData.temporalRules.lunchbreak.id];

			// 		if (customHours.enabled === 'false' || !customHours.opendays || customHours.opendays.length === 0) {
			// 			mainCallflow.flow.children._ = formatChildModule(strategyData.callflows.MainOpenHours.id);
			// 		} else {
			// 			var tmpRulesRequests = {};

			// 			mainCallflow.flow.children._ = formatChildModule(strategyData.callflows.MainAfterHours.id);

			// 			if (customHours.lunchbreak.enabled) {
			// 				var lunchbreakRule = strategyData.temporalRules.lunchbreak;

			// 				_.assign(lunchbreakRule, {
			// 					wdays: _.map(customHours.opendays, function(item) {
			// 						// make sure the lunch rule is only valid on days the business is open
			// 						return _
			// 							.chain(item)
			// 							.toLower()
			// 							.replace(/^main/, '')
			// 							.value();
			// 					}),
			// 					time_window_start: monster.util.timeToSeconds(customHours.lunchbreak.start),
			// 					time_window_stop: monster.util.timeToSeconds(customHours.lunchbreak.end)
			// 				});

			// 				tmpRulesRequests.lunchbreak = function(callback) {
			// 					self.callApi({
			// 						resource: 'temporalRule.update',
			// 						data: {
			// 							accountId: self.accountId,
			// 							ruleId: lunchbreakRule.id,
			// 							data: lunchbreakRule
			// 						},
			// 						success: function(data, status) {
			// 							callback(null, data.data);
			// 						}
			// 					});
			// 				};

			// 				mainCallflow.flow.children[lunchbreakRule.id] = formatChildModule(strategyData.callflows.MainLunchHours.id);
			// 			}

			// 			_.each(customHours.opendays, function(val) {
			// 				var temporalRule = strategyData.temporalRules.weekdays[val];
			// 				temporalRule.time_window_start = monster.util.timeToSeconds(customHours.weekdays[val].start);
			// 				temporalRule.time_window_stop = monster.util.timeToSeconds(customHours.weekdays[val].end);
			// 				tmpRulesRequests[val] = function(callback) {
			// 					self.callApi({
			// 						resource: 'temporalRule.update',
			// 						data: {
			// 							accountId: self.accountId,
			// 							ruleId: temporalRule.id,
			// 							data: temporalRule
			// 						},
			// 						success: function(data, status) {
			// 							callback(null, data.data);
			// 						}
			// 					});
			// 				};

			// 				mainCallflow.flow.children[temporalRule.id] = formatChildModule(strategyData.callflows.MainOpenHours.id);
			// 			});

			// 			monster.parallel(tmpRulesRequests, function(err, results) {});
			// 		}

			// 		self.strategyRebuildMainCallflowRuleArray(strategyData);
			// 		self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
			// 			strategyData.callflows.MainCallflow = updatedCallflow;
			// 			parent.find('.element-content').hide();
			// 			parent.removeClass('open');
			// 		});
			// 	}
			// });
		},

		strategyHoursListingBindEvents: function(parent, template) {
			var self = this;

			template.on('click', '.office-hours-nav .nav-item:not(.active):not(.disabled)', function(event) {
				var $this = $(this),
					day = $this.data('day');

				template.find('.office-hours-nav .nav-item.active').removeClass('active');
				$this.addClass('active');

				if (day) {
					template.find('.office-hours').hide();
					template.find('.office-hours[data-day="' + day + '"]').fadeIn(200);
				} else {
					template.find('.office-hours').fadeIn(200);
				}
			});

			template.on('change', '.office-hours-content .empty-state select[name="template"]', function(event) {
				event.preventDefault();

				var option = $(this).val();

				if (!option) {
					return;
				}

				self.strategyHoursListingRender(parent, self.templatePresets[option]);
			});

			template.on('change', 'input.ui-timepicker-input', function(event) {
				event.preventDefault();

				var $picker = $(this),
					seconds = $picker.timepicker('getSecondsFromMidnight'),
					$boundPicker = $picker.siblings('input'),
					isFrom = _.endsWith($picker.prop('name'), '.start'),
					method = isFrom ? 'minTime' : 'maxTime',
					newTime = isFrom ? seconds + (3600 / 2) : seconds - (3600 / 2);

				$boundPicker.timepicker('option', method, newTime);
			});

			template.on('change', 'input.ui-timepicker-input', function(event) {
				event.preventDefault();

				var $picker = $(this),
					seconds = $picker.timepicker('getSecondsFromMidnight'),
					$interval = $picker.parents('.interval'),
					isFrom = _.endsWith($picker.prop('name'), '.start'),
					$boundPicker = isFrom
						? $interval.prev().find('input[name$=".end"]')
						: $interval.next().find('input[name$=".start"]'),
					isExtremity = !$boundPicker.is(':empty'),
					method = isFrom ? 'maxTime' : 'minTime';

				$boundPicker.timepicker('option', method, seconds);

				if (isExtremity) {
					$picker.timepicker('option', isFrom ? 'minTime' : 'maxTime', isFrom ? 0 : 3600 * 24);
				}
			});

			template.on('click', '.office-hours .delete-interval', function() {
				var $this = $(this),
					$interval = $this.parents('.interval'),
					$intervals = $interval.parents('.intervals'),
					$dayContainer = $interval.parents('.office-hours'),
					$navItems = template.find('.office-hours-nav .nav-item'),
					day = $dayContainer.data('day'),
					$prevPicker = $interval.prev().find('input[name$=".end"]'),
					$nextPicker = $interval.next().find('input[name$=".start"]');

				$interval.slideUp(200, function() {
					$interval.remove();

					$prevPicker.trigger('change');
					$nextPicker.trigger('change');

					if ($intervals.is(':empty')) {
						$dayContainer.slideUp(200, function() {
							$dayContainer.remove();

							$navItems
								.filter('[data-day="' + day + '"]')
									.removeClass('active')
									.addClass('disabled');

							$navItems.filter(':not([data-day])').click();

							if (template.find('.office-hours-content .office-hours').length === 0) {
								template.find('.office-hours-content .empty-state').slideDown(200);
							}
						});
					}
				});
			});
		},

		strategyHoursGetIntervalsFromTemplate: function(parent) {
			var self = this,
				days = self.weekdays;

			return _.map(days, function(day) {
				var $el = parent.find('.office-hours[data-day="' + day + '"]');

				return _.map($el.find('.interval'), function(interval) {
					var $interval = $(interval);

					return {
						start: $interval.find('input[name$=".start"]').timepicker('getSecondsFromMidnight'),
						end: $interval.find('input[name$=".end"]').timepicker('getSecondsFromMidnight'),
						isOpen: $interval.find('select.status').val() === 'true'
					};
				});
			});
		}
	};
});
