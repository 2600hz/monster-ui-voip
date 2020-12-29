define(function(require) {
	var monster = require('monster'),
		_ = require('lodash'),
		$ = require('jquery'),
		footable = require('footable');

	return {
		subscribe: {
			'voip.strategyHolidays.render': 'strategyHolidaysRender'
		},

		appFlags: {
			strategyHolidays: {
				months: [
					'Jan',
					'Feb',
					'Mar',
					'Apr',
					'May',
					'Jun',
					'Jul',
					'Aug',
					'Sep',
					'Oct',
					'Nov',
					'Dec'
				],
				days: [
					'Mon',
					'Tue',
					'Wed',
					'Thu',
					'Fri',
					'Sat',
					'Sun'
				]
			}
		},

		strategyHolidaysRender: function(args) {
			var self = this,
				$container = args.container,
				strategyData = args.strategyData,
				holidaysData = self.strategyHolidaysExtractHolidaysFromStrategyData(strategyData),
				callback = args.callback,
				getListOfYears = function getListOfYears() {
					var date = new Date(),
						year = parseInt(date.getFullYear()),
						totalYears = 3,
						yearsArray = [];

					while (totalYears >= 0) {
						yearsArray.push(year);
						year++;
						totalYears--;
					}

					return yearsArray;
				},
				template = $(self.getTemplate({
					name: 'layout',
					data: {
						enabled: !_.isEmpty(strategyData.temporalRules.holidays),
						years: getListOfYears()
					},
					submodule: 'strategyHolidays'
				}));

			$container
				.find('.element-content')
					.empty()
					.append(template);

			monster.ui.footable(template.find('.footable'), {
				filtering: {
					placeholder: self.i18n.active().strategy.holidays.listing.search
				},
				paging: {
					enabled: false
				},
				on: {
					'postdraw.ft.table': function(event, ft) {
						var dataArray = ft.rows.array;

						if (_.size(dataArray) < 1) {
							template
								.find('.custom-footable-empty')
									.addClass('show');
						} else {
							template
								.find('.custom-footable-empty')
									.removeClass('show');
						}
					}
				}
			});

			self.strategyHolidaysListingRender($container, holidaysData);
			self.strategyHolidaysBindEvents($container, template, strategyData);

			callback && callback();
		},

		strategyHolidaysListingRender: function($container, holidaysData) {
			var self = this,
				table = footable.get('#holidays_list_table'),
				holidaysDataArray = [],
				initTemplate = function initTemplate(data) {
					var dateToDisplay = function dateToDisplay($container, data) {
							var getNumberWithOrdinal = function getNumberWithOrdinal(date) {
									var ordinal = ['th', 'st', 'nd', 'rd'],
										v = date % 100;
									return date + (ordinal[(v - 20) % 10] || ordinal[v] || ordinal[0]);
								},
								holidayData = data.holidayData,
								months = self.appFlags.strategyHolidays.months,
								fromMonth = months[holidayData.fromMonth - 1],
								days = self.appFlags.strategyHolidays.days,
								fromDay = getNumberWithOrdinal(holidayData.fromDay),
								yearSelected = $container.find('#year').val(),
								dateToText = '';

							switch (data.holidayType) {
								case 'advanced':
									var ordinal = monster.util.tryI18n(self.i18n.active().strategy.ordinals, holidayData.ordinal),
										day = monster.util.tryI18n(self.i18n.active().strategy.holidays.days, holidayData.wday);

									dateToText = fromMonth + ' ' + ordinal + ' ' + day;

									break;

								case 'single':
									dateToText = fromMonth + ' ' + fromDay;

									break;

								case 'range':
									var toMonth = months[holidayData.toMonth - 1],
										toDay = getNumberWithOrdinal(holidayData.toDay);

									dateToText = fromMonth + ' ' + fromDay + ' - ' + toMonth + ' ' + toDay;

									break;
							}

							return dateToText;
						},
						template = $(self.getTemplate({
							name: 'listing',
							data: {
								holidayType: data.holidayType,
								holidayData: data.holidayData,
								dateToDisplay: dateToDisplay($container, data)
							},
							submodule: 'strategyHolidays'
						}));

					self.strategyHolidaysListingBindEvents($container, template);

					return template;
				};

			_.each(holidaysData, function(value, key) {
				console.log(value);
				holidaysDataArray.push(initTemplate(value));
			});

			table.rows.load(holidaysDataArray, true);
		},

		strategyHolidaysAddEditDialogRender: function(parent, data) {
			var self = this,
				template = $(self.getTemplate({
					name: 'dialog-add-edit-holiday',
					data: {
						holidayName: data.holidayName
					},
					submodule: 'strategyHolidays'
				})),
				optionsPopup = {
					position: ['center', 20],
					title: '<i class="fa fa-warning monster-red"></i><div class="title">' + self.i18n.active().strategy.holidays.dialogs.delete.title + '</div>',
					dialogClass: 'monster-alert holiday-delete-dialog'
				},
				popup = monster.ui.dialog(template, optionsPopup);

			self.strategyHolidaysAddEditDialogBindsEvents(template, parent, popup, data.holidayId);
		},

		strategyHolidaysDeleteDialogRender: function(parent, data) {
			var self = this,
				template = $(self.getTemplate({
					name: 'dialog-delete-holiday',
					data: {
						holidayName: data.holidayName
					},
					submodule: 'strategyHolidays'
				})),
				optionsPopup = {
					position: ['center', 20],
					title: '<i class="fa fa-warning monster-red"></i><div class="title">' + self.i18n.active().strategy.holidays.dialogs.delete.title + '</div>',
					dialogClass: 'monster-alert holiday-delete-dialog'
				},
				popup = monster.ui.dialog(template, optionsPopup);

			self.strategyHolidaysDeleteDialogBindsEvents(template, parent, popup, data.holidayId);
		},

		strategyHolidaysBindEvents: function(parent, template, strategyData) {
			var self = this;

			parent.on('change', '.holidays-toggler input[type="checkbox"]', function() {
				var $this = $(this);

				if ($this.prop('checked')) {
					parent
						.find('.holidays-div')
						.slideDown();
				} else {
					parent
						.find('.holidays-div')
						.slideUp();
				}
			});

			template.on('click', '.add-holiday', function(event) {
				event.preventDefault();

				monster.pub('voip.strategy.addEditOfficeHolidays', {
					data: {},
					callback: function(err, data) {
						console.log('add-holiday');
					}
				});
			});

			template.on('click', '.import-holidays', function(event) {
				event.preventDefault();

				console.log('import-holidays');
			});

			template.on('click', '.national-holidays', function(event) {
				event.preventDefault();

				console.log('national-holidays');
			});

			template.on('click', '.save-button', function(event) {
				event.preventDefault();

				var parent = $(this).parents('.element-container'),
					mainCallflow = strategyData.callflows.MainCallflow,
					holidaysEnabled = parent.find('.holidays-toggler input[type="checkbox"]')[0].checked,
					holidayRulesRequests = {},
					invalidData = false;

				if (holidaysEnabled) {
					$.each(container.find('.holidays-element'), function() {
						var holidayRule = self.strategyBuildHolidayRule($(this), holidayRulesRequests);

						if (!holidayRule) {
							invalidData = true;
							return false;
						}

						holidayRulesRequests[holidayRule.name] = function(callback) {
							// ghetto strategyBuildHoliday builds a complete different object for a range, so we check if one of the different key is in there, if yes, this is a range spanning multiple months
							if (holidayRule.hasOwnProperty('isRange')) {
								self.strategyBuildMultiMonthRangeHoliday(holidayRule, function(data) {
									data.viewData = holidayRule;
									callback && callback(null, data);
								});
							} else {
								self.strategyCleanUpdateHoliday(holidayRule, function(data) {
									callback && callback(null, data);
								});
							}
						};
					});

					if (invalidData) {
						monster.ui.alert(self.i18n.active().strategy.alertMessages.uniqueHoliday);
					} else {
						monster.parallel(holidayRulesRequests, function(err, results) {
							// First extract all ids from the new holidayList
							var existingHolidaysCallflowsIds = [],
								newHolidayCallflowsIds = _.map(holidayRulesRequests, 'id');

							// Find all IDs of existing Callflows in the Main Callflow that are linking to the Main Holidays
							_.each(mainCallflow.flow.children, function(directChild, id) {
								if (id !== '_' && directChild.data.id === strategyData.callflows.MainHolidays.id) {
									existingHolidaysCallflowsIds.push(id);
								}
							});

							// Now see if any of these existing IDs that are no longer in the list of holidays
							// If we find orphans, remove them from the main callflow
							_.each(existingHolidaysCallflowsIds, function(id) {
								if (newHolidayCallflowsIds.indexOf(id) < 0) {
									delete mainCallflow.flow.children[id];
								}
							});

							_.each(results, function(val, key) {
								mainCallflow.flow.children[val.id] = {
									children: {},
									data: {
										id: strategyData.callflows.MainHolidays.id
									},
									module: 'callflow'
								};
								_.set(strategyData.temporalRules, ['holidays', val.name], val);
							});

							self.strategyRebuildMainCallflowRuleArray(strategyData);
							self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
								strategyData.callflows.MainCallflow = updatedCallflow;
								parent.find('.element-content').hide();
								parent.removeClass('open');
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().strategy.toastrMessages.updateHolidaySuccess
								});
							});
						});
					}
				} else {
					monster.ui.confirm(self.i18n.active().strategy.confirmMessages.disableHolidays, function() {
						_.each(_.get(strategyData.temporalRules, 'holidays', {}), function(val, key) {
							holidayRulesRequests[key] = function(callback) {
								if (val.hasOwnProperty('temporal_rules')) {
									self.strategyDeleteRuleSetAndRules(val.id, function() {
										delete mainCallflow.flow.children[val.id];
										callback(null, {});
									});
								} else {
									self.strategyDeleteHoliday(val.id, function() {
										delete mainCallflow.flow.children[val.id];
										callback(null, {});
									});
								}
							};
						});

						monster.parallel(holidayRulesRequests, function(err, results) {
							_.set(strategyData.temporalRules, 'holidays', {});
							self.strategyRebuildMainCallflowRuleArray(strategyData);
							self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
								strategyData.callflows.MainCallflow = updatedCallflow;
								parent.find('.element-content').hide();
								parent.removeClass('open');
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().strategy.toastrMessages.updateHolidaySuccess
								});
							});
						});
					});
				}
			});
		},

		strategyHolidaysListingBindEvents: function(parent, template) {
			var self = this;

			template.on('click', '.edit-holiday', function(event) {
				event.preventDefault();

				var $this = $(this),
					type = $this.data('type'),
					id = $this.parents('tr').data('id');

				if (type === 'delete') {
					var holidayName = $this.parents('tr').find('td:first-child').html();

					self.strategyHolidaysDeleteDialogRender(parent,
						{
							holidayName: holidayName,
							holidayId: id
						}
					);
				} else {
					console.log('edit');
				}
			});
		},

		strategyHolidaysAddEditDialogBindsEvents: function(template, parent, popup, holidayId) {
			var self = this;

			template.find('.cancel').on('click', function(event) {
				popup.dialog('close').remove();
			});

			template.find('.delete').on('click', function(event) {
				event.preventDefault();

				parent
					.find('#holidays_list_table tbody tr[data-id="' + holidayId + '"]')
					.remove();

				popup.dialog('close').remove();
			});
		},

		strategyHolidaysDeleteDialogBindsEvents: function(template, parent, popup, holidayId) {
			var self = this;

			template.find('.cancel').on('click', function(event) {
				popup.dialog('close').remove();
			});

			template.find('.delete').on('click', function(event) {
				event.preventDefault();

				var $this = $(this),
					table = footable.get('#holidays_list_table'),
					$row = parent.find('#holidays_list_table tbody tr[data-id="' + holidayId + '"]'),
					rowId = $row.index(),
					tableRows = table.rows.all;

				tableRows[rowId].delete();

				popup.dialog('close').remove();
			});
		},

		/**
		 * Returns an array of objects all holidays.
		 * @param  {Object} strategyData.temporalRules
		 * @return {Array[]}
		 * Holidays are extracted from temporal rules
		 */
		strategyHolidaysExtractHolidaysFromStrategyData: function(strategyData) {
			var self = this,
				holidaysData = [];

			_.each(_.get(strategyData.temporalRules, 'holidays', {}), function(val, key) {
				if (val.id in strategyData.callflows.MainCallflow.flow.children) {
					var holidayType,
						holidayData = {
							id: val.id,
							name: val.name,
							fromMonth: val.month
						};

					if (val.hasOwnProperty('ordinal')) {
						holidayType = 'advanced';
						holidayData.ordinal = val.ordinal;
						holidayData.wday = val.wdays[0];
					} else {
						if (val.hasOwnProperty('viewData')) {
							holidayType = 'range';
							holidayData.fromDay = val.viewData.fromDay;
							holidayData.fromMonth = val.viewData.fromMonth;
							holidayData.toDay = val.viewData.toDay;
							holidayData.toMonth = val.viewData.toMonth;
							holidayData.set = true;
						} else {
							holidayData.fromDay = val.days[0];

							if (val.days.length > 1) {
								holidayType = 'range';
								holidayData.toDay = val.days[val.days.length - 1];
								holidayData.toMonth = val.month;
							} else {
								holidayType = 'single';
							}
						}
					}

					holidaysData.push({ holidayType: holidayType, holidayData: holidayData });
				}
			});

			return holidaysData;
		},

		strategyDeleteRuleSetAndRules: function(id, globalCallback) {
			var self = this;

			self.strategyGetRuleSet(id, function(data) {
				var parallelRequests = {};

				_.each(data.temporal_rules, function(id) {
					parallelRequests[id] = function(callback) {
						self.strategyDeleteHoliday(id, function() {
							callback && callback(null, {});
						});
					};
				});

				monster.parallel(parallelRequests, function(err, results) {
					self.strategyDeleteRuleSet(id, function(data) {
						globalCallback && globalCallback(data);
					});
				});
			});
		},

		strategyDeleteRuleSet: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.delete',
				data: {
					accountId: self.accountId,
					setId: id
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		strategyCleanUpdateHoliday: function(data, callback) {
			var self = this,
				updateHoliday = function() {
					delete data.extra;

					self.strategyUpdateHoliday(data, function(data) {
						callback && callback(data);
					});
				};

			if (data.extra.oldType === 'set') {
				self.strategyDeleteRuleSetAndRules(data.id, function() {
					delete data.id;

					updateHoliday();
				});
			} else {
				updateHoliday();
			}
		},

		strategyBuildMultiMonthRangeHoliday: function(data, globalCallback) {
			var self = this,
				fromDay = parseInt(data.fromDay),
				fromMonth = parseInt(data.fromMonth),
				toDay = parseInt(data.toDay),
				toMonth = parseInt(data.toMonth),
				name = data.name,
				getMonthRule = function(name, pMonth, pStartDay, pEndDay) {
					var month = parseInt(pMonth),
						fromDay = pStartDay || 1,
						toDay = pEndDay || 31,
						days = [];

					for (var day = fromDay; day <= toDay; day++) {
						days.push(day);
					}

					return {
						name: name + '_' + month,
						cycle: 'yearly',
						days: days,
						interval: 1,
						month: month
					};
				},
				rulesToCreate = [],
				ruleSet = {
					name: name,
					temporal_rules: [],
					type: 'main_holidays'
				},

				parallelRequests = {},
				junkName = name + '_' + monster.util.randomString(6);

			if (fromMonth !== toMonth) {
				rulesToCreate.push(getMonthRule(junkName, fromMonth, fromDay, 31));

				var firstMonthLoop = fromMonth === 12 ? 1 : fromMonth + 1;

				for (var loopMonth = firstMonthLoop; (loopMonth !== toMonth && (loopMonth - 12) !== toMonth); loopMonth++) {
					if (loopMonth === 13) { loopMonth = 1; }
					rulesToCreate.push(getMonthRule(junkName, loopMonth, 1, 31));
				}

				rulesToCreate.push(getMonthRule(junkName, toMonth, 1, toDay));
			} else {
				rulesToCreate.push(getMonthRule(junkName, fromMonth, fromDay, toDay));
			}

			_.each(rulesToCreate, function(rule) {
				parallelRequests[rule.name] = function(callback) {
					self.strategyUpdateHoliday(rule, function(data) {
						callback && callback(null, data);
					});
				};
			});

			var createCleanSet = function() {
				// Create All Rules, and then Create Rule Set.
				monster.parallel(parallelRequests, function(err, results) {
					_.each(rulesToCreate, function(rule) {
						ruleSet.temporal_rules.push(results[rule.name].id);
					});

					self.strategyCreateRuleSet(ruleSet, function(data) {
						globalCallback(data);
					});
				});
			};

			if (data.hasOwnProperty('id')) {
				if (data.extra.oldType === 'rule') {
					self.strategyDeleteHoliday(data.id, function() {
						createCleanSet();
					});
				} else {
					self.strategyDeleteRuleSetAndRules(data.id, function() {
						createCleanSet();
					});
				}
			} else {
				createCleanSet();
			}
		}
	};
});
