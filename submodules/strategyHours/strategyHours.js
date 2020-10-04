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
				intervals = self.strategyHoursGetIntervalsFromStrategyData(strategyData),
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						alwaysOpen: _.every(intervals, _.isEmpty),
						companyTimezone: timezone.formatTimezone(strategyData.callflows.MainCallflow.flow.data.timezone || monster.apps.auth.currentAccount.timezone)
					},
					submodule: 'strategyHours'
				}));

			$container
				.find('.element-content')
					.empty()
					.append(template);

			self.strategyHoursListingRender($container, intervals);
			self.strategyHoursBindEvents($container, template, strategyData);

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

				var $button = $(event.originalEvent.submitter),
					$section = $(this).parents('.element-container'),
					formData = monster.ui.getFormData('strategy_custom_hours_form'),
					is24hStrategy = formData.enabled === 'true',
					weekdays = self.weekdays,
					intervals = is24hStrategy
						? self.strategyHoursGetIntervalsFromTemplate(parent)
						: _.map(weekdays, function() { return []; });

				$button.prop('disabled', 'disabled');

				self.strategyHoursSaveStrategyData(intervals, strategyData, function() {
					$section.find('.element-content').slideUp();
					$section.removeClass('open');
				});
			});
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

		/**
		 * @param  {Object} args.open
		 * @param  {Object[]} args.lunch
		 * @return {Array}
		 */
		strategyHoursBuildIntervalsSetForDay: function(args) {
			var open = _.get(args, 'open', {}),
				lunch = _.get(args, 'lunch', []),
				hasIntervals = !_.every([open, lunch], _.isEmpty),
				openStart = open.start,
				openEnd = open.end,
				firstLunch = _.first(lunch) || {},
				lastLunch = _.last(lunch) || {},
				shouldFirstIntervalBeFilledIn = hasIntervals && (_.isEmpty(lunch) || openStart < firstLunch.start),
				firstOpenInterval = shouldFirstIntervalBeFilledIn ? [{
					start: openStart,
					end: _.isEmpty(lunch) || openEnd < firstLunch.end
						? openEnd
						: firstLunch.start,
					isOpen: true
				}] : [],
				lastOpenInterval = openEnd > lastLunch.end ? [{
					start: lastLunch.end,
					end: openEnd,
					isOpen: true
				}] : [];

			return _.concat(
				firstOpenInterval,
				_.flatMap(lunch, function(interval, index) {
					var previous = lunch[index - 1],
						shouldFillIn = !_.isUndefined(previous) && openEnd > previous.end;

					return _.flatMap([
						shouldFillIn ? [{
							start: previous.end,
							end: openEnd < interval.start
								? openEnd
								: interval.start,
							isOpen: true
						}] : [],
						_.merge({}, interval, {
							isOpen: false
						})
					]);
				}),
				lastOpenInterval
			);
		},

		strategyHoursGetIntervalsFromStrategyData: function(strategyData) {
			var self = this,
				weekdays = self.weekdays,
				activeRulesIds = _
					.chain(strategyData.callflows.MainCallflow)
					.get('flow.children', {})
					.omit('_')
					.keys()
					.value(),
				isRuleActive = _.flow(
					_.partial(_.get, _, 'id'),
					_.partial(_.includes, activeRulesIds)
				),
				getIntervalsFromRule = function(rule, isOpen) {
					return _.map(rule.wdays, function(day) {
						return {
							day: day,
							start: rule.time_window_start,
							end: rule.time_window_stop,
							isOpen: isOpen
						};
					});
				},
				extractIntervalsFromRules = function(rules, isOpen) {
					return _
						.chain(rules)
						.map()
						.filter(isRuleActive)
						.flatMap(_.partial(getIntervalsFromRule, _, isOpen))
						.groupBy('day')
						.mapValues(function(intervals) {
							return _.map(intervals, _.partial(_.omit, _, 'day'));
						})
						.value();
				},
				openIntervalsPerDay = extractIntervalsFromRules(strategyData.temporalRules.weekdays, true),
				lunchIntervalsPerDay = extractIntervalsFromRules(strategyData.temporalRules.lunchbreak, false);

			return _.map(weekdays, function(day) {
				return self.strategyHoursBuildIntervalsSetForDay({
					open: _
						.chain(openIntervalsPerDay)
						.get(day, [])
						.first()
						.value(),
					lunch: _.get(lunchIntervalsPerDay, day, [])
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
		},

		strategyHoursUpdateOpenHoursRules: function(days, existingOpenRules, callback) {
			var self = this,
				groupRulesByAction = function groupRulesByAction(intervalsWithDays, existingOpenRules) {
					var weekdays = self.weekdays,
						rules = {
							toUnset: [],
							toUpdate: [],
							toUse: []
						};

					_.forEach(days, function(intervals, index) {
						var firstOpen = _.find(intervals, { isOpen: true }),
							lastOpen = _.findLast(intervals, { isOpen: true }),
							weekdayId = 'Main' + _.capitalize(weekdays[index]),
							rule = _.get(existingOpenRules, weekdayId),
							isUnset = _.isUndefined(firstOpen),
							shouldUpdate = _.some([
								_.get(firstOpen, 'start') !== rule.time_window_start,
								_.get(lastOpen, 'end') !== rule.time_window_stop
							]);

						if (isUnset) {
							rules.toUnset.push(rule);
						} else if (shouldUpdate) {
							rules.toUpdate.push({
								id: rule.id,
								start: _.get(firstOpen, 'start'),
								end: _.get(lastOpen, 'end')
							});
						} else {
							rules.toUse.push(rule);
						}
					});

					return rules;
				},
				buildRequestsFromActions = function buildRequestsFromActions(rulesPerAction) {
					var toReuse = _.map(rulesPerAction.toUse, function(rule) {
							return function(next) {
								next(null, rule);
							};
						}),
						toUpdate = _.map(rulesPerAction.toUpdate, function(interval) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.patch',
									data: {
										accountId: self.accountId,
										ruleId: interval.id,
										data: {
											time_window_start: interval.start,
											time_window_stop: interval.end
										}
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						}),
						toRemove = _.map(rulesPerAction.toUnset, function(rule) {
							return function(next) {
								next(null, rule);
							};
						});

					return {
						toAdd: function(next) {
							monster.parallel(_.flatten([
								toReuse,
								toUpdate
							]), next);
						},
						toRemove: function(next) {
							monster.parallel(toRemove, next);
						}
					};
				};

			monster.parallel(_.flow(
				_.partial(groupRulesByAction, _, existingOpenRules),
				buildRequestsFromActions
			)(days), callback);
		},

		strategyHoursUpdateLunchHoursRules: function(days, existingLunchRules, callback) {
			var self = this,
				weekdays = self.weekdays,
				combineIntervals = function combineIntervals(days) {
					return _
						.chain(days)
						.flatMap(function(intervals, index) {
							return _.map(intervals, function(interval) {
								return _.merge({
									day: weekdays[index]
								}, interval);
							});
						})
						.groupBy(function(interval) {
							return _.join([interval.start, interval.end], ',');
						})
						.map(function(intervals, key) {
							var times = _
								.chain(key)
								.split(',')
								.map(Number)
								.value();
							return {
								start: _.head(times),
								end: _.last(times),
								days: _.map(intervals, 'day')
							};
						})
						.value();
				},
				getUnusedRules = function(existingRules, usedIds) {
					return _.reject(existingRules, _.flow(
						_.partial(_.get, _, 'id'),
						_.partial(_.includes, usedIds)
					));
				},
				findRuleMatchingTimes = function(rules, start, end) {
					return _.find(rules, {
						time_window_start: start,
						time_window_stop: end
					});
				},
				findRuleMatchingDays = function(rules, days) {
					return _.find(rules, function(rule) {
						return _.isEqual(_.sortBy(rule.wdays), _.sortBy(days));
					});
				},
				compareRules = function(a, b) {
					var ids = _.map([a, b], 'id');
					return !_.some(ids, _.isUndefined) && _.spread(_.isEqual)(ids);
				},
				getUsedRulesIds = function() {
					return _
						.chain(arguments)
						.toArray()
						.flatten()
						.map('id')
						.value();
				},
				isNotUndefined = _.negate(_.isUndefined),
				groupRulesByAction = function groupRulesByAction(intervalsByDays, existingRules) {
					var toReuse = [],
						toUpdate = [],
						toCreate = [];

					_.forEach(intervalsByDays, function(interval) {
						var unsuedRules = getUnusedRules(existingRules, getUsedRulesIds(toReuse, toUpdate)),
							matchingTimes = findRuleMatchingTimes(unsuedRules, interval.start, interval.end),
							matchingDays = findRuleMatchingDays(unsuedRules, interval.days),
							matchingRules = [matchingTimes, matchingDays];

						if (compareRules(matchingTimes, matchingDays)) {
							toReuse.push(matchingTimes);
						} else if (_.some(matchingRules, isNotUndefined)) {
							toUpdate.push(_.merge({
								id: _.find(matchingRules, _.flow(
									_.partial(_.get, _, 'id'),
									isNotUndefined
								)).id
							}, interval));
						} else {
							toCreate.push(interval);
						}
					});

					return {
						toReuse: toReuse,
						toUpdate: toUpdate,
						toCreate: toCreate,
						toDelete: _.reject(existingRules, _.flow(
							_.partial(_.get, _, 'id'),
							_.partial(_.includes, getUsedRulesIds(toReuse, toUpdate))
						))
					};
				},
				buildRequestsFromActions = function buildRequestsFromActions(rulesPerAction) {
					var toReuse = _.map(rulesPerAction.toReuse, function(rule) {
							return function(next) {
								next(null, rule);
							};
						}),
						toUpdate = _.map(rulesPerAction.toUpdate, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.patch',
									data: {
										accountId: self.accountId,
										ruleId: rule.id,
										data: {
											time_window_start: rule.start,
											time_window_stop: rule.end,
											wdays: rule.days
										}
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						}),
						toCreate = _.map(rulesPerAction.toCreate, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.create',
									data: {
										accountId: self.accountId,
										data: {
											cycle: 'weekly',
											interval: 1,
											name: 'MainLunchHours',
											type: 'main_lunchbreak',
											time_window_start: rule.start,
											time_window_stop: rule.end,
											wdays: rule.days
										}
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						}),
						toDelete = _.map(rulesPerAction.toDelete, function(rule) {
							return function(next) {
								self.callApi({
									resource: 'temporalRule.delete',
									data: {
										accountId: self.accountId,
										ruleId: rule.id
									},
									success: _.flow(
										_.partial(_.get, _, 'data'),
										_.partial(next, null)
									),
									error: _.partial(next, null)
								});
							};
						});

					return {
						toAdd: function(next) {
							monster.parallel(_.flatten([
								toReuse,
								toUpdate,
								toCreate
							]), next);
						},
						toRemove: function(next) {
							monster.parallel(toDelete, next);
						}
					};
				};

			monster.parallel(_.flow(
				combineIntervals,
				_.partial(groupRulesByAction, _, existingLunchRules),
				buildRequestsFromActions
			)(days), callback);
		},

		strategyHoursSaveStrategyData: function(intervals, strategyData, callback) {
			var self = this,
				openHoursIntervals = _.map(intervals, _.partial(_.filter, _, { isOpen: true })),
				lunchHoursIntervals = _.map(intervals, _.partial(_.filter, _, { isOpen: false })),
				updateStrategyData = function updateStrategyData(err, rules, strategyData) {
					var openRules = _.get(rules, 'weekdays', {}),
						lunchRules = _.get(rules, 'lunchbreak', {}),
						mainOpenHoursCallflowId = strategyData.callflows.MainOpenHours.id,
						mainLunchHoursCallflowId = strategyData.callflows.MainLunchHours.id;

					_.forEach(openRules.toAdd, function(rule) {
						var ruleKey = _.findKey(strategyData.temporalRules.weekdays, { id: rule.id });

						strategyData.temporalRules.weekdays[ruleKey] = rule;
						strategyData.callflows.MainCallflow.flow.children[rule.id] = {
							children: {},
							data: {
								id: mainOpenHoursCallflowId
							},
							module: 'callflow'
						};
					});
					_.forEach(openRules.toRemove, function(rule) {
						delete strategyData.callflows.MainCallflow.flow.children[rule.id];
					});

					_.forEach(lunchRules.toAdd, function(rule) {
						strategyData.temporalRules.lunchbreak[rule.id] = rule;
						strategyData.callflows.MainCallflow.flow.children[rule.id] = {
							children: {},
							data: {
								id: mainLunchHoursCallflowId
							},
							module: 'callflow'
						};
					});
					_.forEach(lunchRules.toRemove, function(rule) {
						delete strategyData.temporalRules.lunchbreak[rule.id];
						delete strategyData.callflows.MainCallflow.flow.children[rule.id];
					});

					strategyData.callflows.MainCallflow.flow.children._ = {
						children: {},
						data: {
							id: _
								.chain([
									_.map(strategyData.temporalRules.weekdays, 'id'),
									_.map(strategyData.temporalRules.lunchbreak, 'id')
								])
								.flatten()
								.every(_.partial(_.negate(_.includes), _.keys(strategyData.callflows.MainCallflow.flow.children)))
								.value() ? strategyData.callflows.MainOpenHours.id : strategyData.callflows.MainAfterHours.id
						},
						module: 'callflow'
					};

					self.strategyRebuildMainCallflowRuleArray(strategyData);
					self.strategyUpdateCallflow(strategyData.callflows.MainCallflow, function(updatedCallflow) {
						strategyData.callflows.MainCallflow = updatedCallflow;
						callback();
					});
				};

			monster.parallel({
				weekdays: _.bind(self.strategyHoursUpdateOpenHoursRules, self, openHoursIntervals, strategyData.temporalRules.weekdays),
				lunchbreak: _.bind(self.strategyHoursUpdateLunchHoursRules, self, lunchHoursIntervals, strategyData.temporalRules.lunchbreak)
			}, _.partial(updateStrategyData, _, _, strategyData));
		}
	};
});
