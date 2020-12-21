define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var app = {

		requests: {
		},

		subscribe: {
			'voip.strategy.render': 'strategyRender',
			'auth.currentAccountUpdated': '_strategyOnCurrentAccountUpdated'
		},

		weekdays: [
			'monday',
			'tuesday',
			'wednesday',
			'thursday',
			'friday',
			'saturday',
			'sunday'
		],

		weekdayLabels: [
			'MainMonday',
			'MainTuesday',
			'MainWednesday',
			'MainThursday',
			'MainFriday',
			'MainSaturday',
			'MainSunday'
		],

		subCallflowsLabel: [
			'MainOpenHours',
			'MainAfterHours',
			'MainLunchHours',
			'MainHolidays'
		],

		featureCodeConfigs: [
			{
				name: 'directed_ext_pickup',
				number: '87',
				pattern: '^\\*87([0-9]+)$',
				moduleName: 'group_pickup_feature',
				metadata: {
					type: 'extension'
				}
			},
			{
				name: 'call_forward[action=deactivate]',
				number: '73',
				callflowNumber: '*73',
				moduleName: 'call_forward',
				actionName: 'deactivate'
			},
			{
				name: 'call_forward[action=activate]',
				number: '72',
				pattern: '\\*72([0-9]*)$',
				moduleName: 'call_forward',
				actionName: 'activate'
			},
			{
				name: 'call_forward[action=toggle]',
				number: '74',
				pattern: '^\\*74([0-9]*)$',
				moduleName: 'call_forward',
				actionName: 'toggle'
			},
			{
				name: 'call_forward[action=update]',
				number: '56',
				callflowNumber: '*56',
				moduleName: 'call_forward',
				actionName: 'update'
			},
			{
				name: 'hotdesk[action=login]',
				number: '11',
				callflowNumber: '*11',
				moduleName: 'hotdesk',
				actionName: 'login'
			},
			{
				name: 'hotdesk[action=logout]',
				number: '12',
				callflowNumber: '*12',
				moduleName: 'hotdesk',
				actionName: 'logout'
			},
			{
				name: 'hotdesk[action=toggle]',
				number: '13',
				callflowNumber: '*13',
				moduleName: 'hotdesk',
				actionName: 'toggle'
			},
			{
				name: 'voicemail[action=check]',
				number: '97',
				pattern: '^\\*97([0-9]*)$',
				moduleName: 'voicemail',
				actionName: 'check'
			},
			{
				name: 'voicemail[single_mailbox_login]',
				number: '98',
				pattern: '^\\*98([0-9]*)$',
				moduleName: 'voicemail',
				actionName: 'check',
				metadata: {
					single_mailbox_login: true
				}
			},
			{
				name: 'voicemail[action="direct"]',
				number: '*',
				pattern: '^\\*\\*([0-9]*)$',
				moduleName: 'voicemail',
				actionName: 'compose'
			},
			{
				name: 'intercom',
				number: '0',
				pattern: '^\\*0([0-9]*)$',
				moduleName: 'intercom',
				actionName: 'compose'
			},
			{
				name: 'privacy[mode=full]',
				number: '67',
				pattern: '^\\*67([0-9]*)$',
				moduleName: 'privacy',
				actionName: 'full'
			},
			{
				name: 'park_and_retrieve',
				number: '3',
				pattern: '^\\*3([0-9]*)$',
				moduleName: 'park',
				actionName: 'auto'
			},
			{
				name: 'valet',
				number: '4',
				callflowNumber: '*4',
				moduleName: 'park',
				actionName: 'park'
			},
			{
				name: 'retrieve',
				number: '5',
				pattern: '^\\*5([0-9]*)$',
				moduleName: 'park',
				actionName: 'retrieve'
			},
			{
				name: 'move',
				number: '6683',
				callflowNumber: '6683',
				moduleName: 'move'
			}
		],

		/**
		 * Render main layout
		 * @param  {Object}   args
		 * @param  {jQuery}   args.parent                      Parent template
		 * @param  {String}   [args.openElement]               Name of the element to display on render
		 * @param  {Function} [args.callback]                  Callback to execute after render
		 */
		strategyRender: function(args) {
			var self = this,
				args = args || {},
				parent = args.parent || $('.right-content'),
				openElement = args.openElement,
				callback = args.callback;

			monster.parallel({
				temporalRules: function(callback) {
					self.strategyGetTemporalRules(function(temporalRules) {
						callback(null, temporalRules);
					});
				},
				callflows: function(callback) {
					self.strategyGetMainCallflows(function(callflows) {
						callback(null, callflows);
					});
				},
				callEntities: function(callback) {
					self.strategyGetCallEntities(function(callEntities) {
						callback(null, callEntities);
					});
				},
				voicemails: function(callback) {
					self.strategyGetVoicesmailBoxes(function(voicemailBoxes) {
						callback(null, voicemailBoxes);
					});
				},
				directories: function(callback) {
					self.strategyListDirectories(function(directories) {
						callback(null, directories);
					});
				}
			}, function(err, results) {
				// has to be > 1 because we automatically add "undefinedMainNumber" as a placeholder for the "0" that will be automatically added if they add a Main number
				var hasMainNumber = (results.callflows.MainCallflow.numbers.length > 1),
					hasConfNumber = (results.callflows.MainConference.numbers.length > 0 && results.callflows.MainConference.numbers[0] !== 'undefinedconf'),
					hasFaxingNumber = (results.callflows.MainFaxing.numbers.length > 0 && results.callflows.MainFaxing.numbers[0] !== 'undefinedfaxing'),
					templateData = {
						mainNumbers: hasMainNumber ? results.callflows.MainCallflow.numbers.slice(1) : [self.i18n.active().strategy.noNumberTitle],
						confNumbers: hasConfNumber ? results.callflows.MainConference.numbers : [self.i18n.active().strategy.noNumberTitle],
						customConfGreeting: results.callflows.MainConference && ('welcome_prompt' in results.callflows.MainConference.flow.data) ? true : false,
						faxingNumbers: hasFaxingNumber ? results.callflows.MainFaxing.numbers : [self.i18n.active().strategy.noNumberTitle]
					},
					template = $(self.getTemplate({
						name: 'layout',
						data: templateData,
						submodule: 'strategy'
					}));

				self.strategyBindEvents(template, results);

				parent
					.empty()
					.append(template);

				monster.ui.tooltips(template);

				if (!hasMainNumber) {
					template.find('.element-container.strategy-hours,.element-container.strategy-holidays,.element-container.strategy-calls').hide();
					template.find('.element-container.helper').css('display', 'block');
					template.find('.element-container.main-number').css('margin-top', '10px');

					self.strategyCheckFirstWalkthrough();
				} else {
					template.find('.element-container.helper').css('display', 'none');
					template.find('.element-container.main-number').css('margin-top', '0px');

					self.strategyCheckSecondWalkthrough();
				}

				if (openElement) {
					var element = template.find('.element-container.' + openElement + ':visible');
					if (element.length > 0) {
						self.strategyRefreshTemplate({
							container: element,
							strategyData: results,
							callback: function() {
								element.addClass('open');
								element.find('.element-content').show();
							}
						});
					}
				}

				callback && callback();
			});

			self.strategyHandleFeatureCodes();
		},

		strategyCheckFirstWalkthrough: function() {
			var self = this,
				flagName = 'showStrategyFirstWalkthrough';

			self.strategyHasWalkthrough(flagName, function() {
				self.strategyShowFirstWalkthrough(function() {
					self.strategyUpdateWalkthroughFlagUser(flagName);
				});
			});
		},

		strategyCheckSecondWalkthrough: function() {
			var self = this,
				flagName = 'showStrategySecondWalkthrough';

			self.strategyHasWalkthrough(flagName, function() {
				self.strategyShowSecondWalkthrough(function() {
					self.strategyUpdateWalkthroughFlagUser(flagName);
				});
			});
		},

		strategyHasWalkthrough: function(name, callback) {
			var self = this,
				flag = self.uiFlags.user.get(name);

			if (flag !== false) {
				callback && callback();
			}
		},

		strategyUpdateWalkthroughFlagUser: function(flagName, callback) {
			var self = this,
				userToSave = self.uiFlags.user.set(flagName, false);

			self.strategyUpdateOriginalUser(userToSave, function(user) {
				callback && callback(user);
			});
		},

		strategyShowFirstWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#strategy_container'),
				steps = [
					{
						element: mainTemplate.find('.element-container.main-number')[0],
						intro: self.i18n.active().strategy.walkthrough.first.steps['1'],
						position: 'bottom'
					}
				];

			monster.ui.stepByStep(steps, function() {
				callback && callback();
			});
		},

		strategyShowSecondWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#strategy_container'),
				steps = [
					{
						element: mainTemplate.find('.element-container.strategy-hours')[0],
						intro: self.i18n.active().strategy.walkthrough.second.steps['1'],
						position: 'bottom'
					},
					{
						element: mainTemplate.find('.element-container.strategy-holidays')[0],
						intro: self.i18n.active().strategy.walkthrough.second.steps['2'],
						position: 'bottom'
					},
					{
						element: mainTemplate.find('.element-container.strategy-calls')[0],
						intro: self.i18n.active().strategy.walkthrough.second.steps['3'],
						position: 'top'
					},
					{
						element: mainTemplate.find('.element-container.strategy-confnum')[0],
						intro: self.i18n.active().strategy.walkthrough.second.steps['4'],
						position: 'top'
					},
					{
						element: mainTemplate.find('.element-container.strategy-faxingnum')[0],
						intro: self.i18n.active().strategy.walkthrough.second.steps['5'],
						position: 'top'
					}
				];

			monster.ui.stepByStep(steps, function() {
				callback && callback();
			});
		},

		/**
		 * Show phone number choices
		 * @param  {Object}   args
		 * @param  {('emergency'|'external')}   args.callerIdType       Caller ID type: emergency, external
		 * @param  {('choose'|'add'|'remove')}  [args.action='choose']  Action being done: Choose, add or remove a number
		 * @param  {String}   [args.oldNumber]  Old number
		 * @param  {String[]} args.newNumbers   New numbers
		 * @param  {Function} [args.save]       Save callback
		 * @param  {Function} [args.cancel]     Cancel callback
		 */
		strategyShowNumberChoices: function(args) {
			var self = this,
				callerIdType = args.callerIdType,
				oldNumber = args.oldNumber,
				template = $(self.getTemplate({
					name: 'changeCallerIdPopup',
					data: {
						action: _.get(args, 'action', 'choose'),
						oldNumber: oldNumber,
						newNumbers: args.newNumbers,
						callerIdType: callerIdType
					},
					submodule: 'strategy'
				})),
				$options = template.find('.choice');

			$options.on('click', function() {
				$options.removeClass('active');

				$(this).addClass('active');
			});

			template.find('.save').on('click', function() {
				var number = template.find('.active').data('number');

				if (number === oldNumber) {
					_.has(args, 'cancel') && args.cancel();
				} else {
					_.has(args, 'save') && args.save(number);
				}

				popup.dialog('close');
			});

			template.find('.cancel-link').on('click', function() {
				popup.dialog('close');

				_.has(args, 'cancel') && args.cancel();
			});

			var popup = monster.ui.dialog(template, {
				title: self.i18n.active().strategy.updateCallerIdDialog.title[callerIdType]
			});
		},

		strategyBindEvents: function(template, strategyData) {
			var self = this,
				containers = template.find('.element-container'),
				strategyNumbersContainer = template.find('.element-container.main-number .element-content'),
				strategyConfNumContainer = template.find('.element-container.strategy-confnum .element-content'),
				strategyFaxingNumContainer = template.find('.element-container.strategy-faxingnum .element-content'),
				strategyHoursContainer = template.find('.element-container.strategy-hours .element-content'),
				strategyHolidaysContainer = template.find('.element-container.strategy-holidays .element-content'),
				strategyCallsContainer = template.find('.element-container.strategy-calls .element-content');

			template.find('.element-header-inner').on('click', function(e) {
				var element = $(this).parents('.element-container');
				if (element.hasClass('open')) {
					element.find('.element-content').slideUp(function() {
						element.removeClass('open');
					});
				} else {
					$.each(containers, function() {
						var $this = $(this);
						if ($this.hasClass('open')) {
							$this.find('.element-content').slideUp(function() {
								$this.removeClass('open');
							});
						}
					});

					self.strategyRefreshTemplate({
						container: element,
						strategyData: strategyData,
						callback: function() {
							element.addClass('open');
							element.find('.element-content').slideDown();
						}
					});
				}
			});

			template.find('.element-container').on('click', '.cancel-link', function(e) {
				e.preventDefault();
				var parent = $(this).parents('.element-container');
				parent.find('.element-content').slideUp(function() {
					parent.removeClass('open');
				});
			});

			self.strategyNumbersBindEvents(strategyNumbersContainer, strategyData);
			self.strategyConfNumBindEvents(strategyConfNumContainer, strategyData);
			self.strategyFaxingNumBindEvents(strategyFaxingNumContainer, strategyData);
			self.strategyHoursBindEvents(strategyHoursContainer, strategyData);
			self.strategyHolidaysBindEvents(strategyHolidaysContainer, strategyData);
			self.strategyCallsBindEvents(strategyCallsContainer, strategyData);
		},

		/**
		 * Check if it is necessary to set the external caller ID for the account
		 * @param  {Object}   args
		 * @param  {String[]} args.numbers  Available phone numbers
		 */
		strategyCheckIfSetExternalCallerID: function(args) {
			var self = this,
				numbers = args.numbers,
				currAcc = monster.apps.auth.currentAccount,
				hasExternalCallerId = _.get(currAcc, 'caller_id.external.number', '') !== '';

			if (hasExternalCallerId || _.isEmpty(numbers)) {
				return;
			}

			monster.waterfall([
				function(callback) {
					if (numbers.length > 1) {
						self.strategyShowNumberChoices({
							callerIdType: 'external',
							newNumbers: numbers,
							save: function(number) {
								callback(null, number);
							},
							cancel: function() {
								callback(null);
							}
						});
					} else {
						callback(null, numbers[0]);
					}
				}
			], function(err, number) {
				if (err || !number) {
					return;
				}

				self.strategyChangeCallerId({
					callerIdType: 'external',
					number: number,
					success: function() {
						monster.ui.toast({
							type: 'success',
							message: self.getTemplate({
								name: '!' + self.i18n.active().strategy.updateCallerIdDialog.success.external,
								data: {
									number: monster.util.formatPhoneNumber(number)
								}
							})
						});
					}
				});
			});
		},

		/**
		 * Check if it is necessary to update the emergency caller ID for the account
		 * @param  {Object}   args
		 * @param  {Object[]} args.templateNumbers      Template numbers
		 * @param  {String[]} args.features             Number features
		 * @param  {String}   args.number               Number ID
		 * @param  {Object}   [args.callbacks]          Function callbacks
		 * @param  {Function} [args.callbacks.success]  Successs callback
		 */
		strategyCheckIfUpdateEmergencyCallerID: function(args) {
			var self = this,
				templateNumbers = args.templateNumbers,
				features = args.features,
				number = args.number;

			// Update data we have about features for main numbers
			_.each(templateNumbers, function(dataLoop) {
				if (dataLoop.number.id === number) {
					dataLoop.number.features = features;
				}
			});

			monster.waterfall([
				function(callback) {
					var currAcc = monster.apps.auth.currentAccount,
						currentE911CallerId = _.get(currAcc, 'caller_id.emergency.number'),
						hasE911Feature = _.includes(features || [], 'e911');

					if (hasE911Feature && _.isEmpty(currentE911CallerId)) {
						callback('OK', number);
					} else {
						callback(null, currentE911CallerId, hasE911Feature);
					}
				},
				function(currentE911CallerId, hasE911Feature, callback) {
					var e911ChoicesArgs,
						e911Numbers = [];

					if (hasE911Feature) {
						if (currentE911CallerId !== number) {
							e911ChoicesArgs = {
								action: 'add',
								oldNumber: currentE911CallerId,
								newNumbers: [ number ]
							};
						}
					} else {
						if (!number || currentE911CallerId === number) {
							e911Numbers = _.chain(templateNumbers)
								.filter(function(number) {
									return _.includes(number.number.features, 'e911');
								}).map('number.id').value();

							if (e911Numbers.length > 1) {
								e911ChoicesArgs = {
									action: number ? 'remove' : 'choose',
									newNumbers: e911Numbers
								};
							}
						}
					}

					if (_.isUndefined(e911ChoicesArgs)) {
						callback('OK', _.head(e911Numbers));
					} else {
						callback(null, e911ChoicesArgs);
					}
				},
				function(e911ChoicesArgs, callback) {
					self.strategyShowNumberChoices(_.merge({
						callerIdType: 'emergency',
						save: function(number) {
							callback(null, number);
						},
						cancel: function() {
							callback('OK');
						}
					}, e911ChoicesArgs));
				}
			], function(err, number) {
				if ((err && err !== 'OK') || !number) {
					return;
				}

				self.strategyChangeCallerId({
					callerIdType: 'emergency',
					number: number,
					success: function() {
						monster.ui.toast({
							type: 'success',
							message: self.getTemplate({
								name: '!' + self.i18n.active().strategy.updateCallerIdDialog.success.emergency,
								data: {
									number: monster.util.formatPhoneNumber(number)
								}
							})
						});

						_.has(args, 'callbacks.success') && args.callbacks.success();
					}
				});
			});
		},

		/**
		 * Refresh a strategy template
		 * @param  {Object}   args
		 * @param  {jQuery}   args.container                   Container template
		 * @param  {Object}   args.strategyData                Strategy data
		 * @param  {Function} [args.callback]                  Optional callback to execute after refresh
		 */
		strategyRefreshTemplate: function(args) {
			var self = this,
				$container = args.container,
				strategyData = args.strategyData,
				callback = args.callback,
				templateName = $container.data('template');

			switch (templateName) {
				case 'numbers':
					self.strategyRefreshTemplateNumbers(
						_.merge(
							{
								templateName: templateName
							}, args)
					);
					break;
				case 'confnum':
					self.strategyListAccountNumbers(function(accountNumbers) {
						var callflow = strategyData.callflows.MainConference,
							numbers = callflow.numbers,
							templateData = {
								hideBuyNumbers: monster.config.whitelabel.hasOwnProperty('hideBuyNumbers')
									? monster.config.whitelabel.hideBuyNumbers
									: false,
								numbers: $.map(numbers, function(val, key) {
									if (val !== 'undefinedconf') {
										return {
											number: val
										};
									}
								}),
								spareLinkEnabled: (_.countBy(accountNumbers, function(number) { return number.used_by ? 'assigned' : 'spare'; }).spare > 0)
							},
							template = $(self.getTemplate({
								name: 'strategy-' + templateName,
								data: templateData,
								submodule: 'strategy'
							}));

						$container
							.find('.element-content')
								.empty()
								.append(template);

						callback && callback();
					});

					break;
				case 'faxingnum':
					self.strategyListAccountNumbers(function(accountNumbers) {
						var callflow = strategyData.callflows.MainFaxing,
							numbers = callflow.numbers,
							templateData = {
								hideBuyNumbers: monster.config.whitelabel.hasOwnProperty('hideBuyNumbers')
									? monster.config.whitelabel.hideBuyNumbers
									: false,
								numbers: $.map(numbers, function(val, key) {
									if (val !== 'undefinedfaxing') {
										return {
											number: val
										};
									}
								}),
								actionLinksEnabled: _.isEmpty(callflow.flow.data),
								spareLinkEnabled: (_.countBy(accountNumbers, function(number) { return number.used_by ? 'assigned' : 'spare'; }).spare > 0)
							},
							template = $(self.getTemplate({
								name: 'strategy-' + templateName,
								data: templateData,
								submodule: 'strategy'
							}));

						$container
							.find('.element-content')
								.empty()
								.append(template);

						callback && callback();
					});

					break;
				case 'hours':
					var is12hMode = monster.apps.auth.currentUser.ui_flags && monster.apps.auth.currentUser.ui_flags.twelve_hours_mode ? true : false,
						secondsToTime = function(seconds) {
							var hours = parseInt(seconds / 3600) % 24,
								minutes = (parseInt(seconds / 60) % 60).toString(),
								suffix = '';

							if (is12hMode) {
								suffix = hours >= 12 ? 'PM' : 'AM';
								hours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
							}
							return hours.toString() + ':' + (minutes.length < 2 ? '0' + minutes : minutes) + suffix;
						},
						weekdaysRules = strategyData.temporalRules.weekdays,
						templateData = {
							alwaysOpen: true,
							companyTimezone: timezone.formatTimezone(strategyData.callflows.MainCallflow.flow.data.timezone || monster.apps.auth.currentAccount.timezone),
							days: [],
							lunchbreak: {
								enabled: (strategyData.temporalRules.lunchbreak.id in strategyData.callflows.MainCallflow.flow.children),
								from: secondsToTime(parseInt(strategyData.temporalRules.lunchbreak.time_window_start, 10)),
								to: secondsToTime(parseInt(strategyData.temporalRules.lunchbreak.time_window_stop, 10))
							}
						},
						template;

					_.each(self.weekdayLabels, function(val) {
						var isOpen = (weekdaysRules[val].id in strategyData.callflows.MainCallflow.flow.children);
						templateData.days.push({
							name: val,
							label: self.i18n.active().strategy.weekdays[val.substring(4).toLowerCase()],
							open: isOpen,
							from: secondsToTime(parseInt(weekdaysRules[val].time_window_start, 10)),
							to: secondsToTime(parseInt(weekdaysRules[val].time_window_stop, 10))
						});

						if (isOpen) {
							templateData.alwaysOpen = false;
						}
					});

					// Setting Monday to Friday enabled by default for 9AM-5PM, when switching from 24hours Open to Custom Hours.
					if (templateData.alwaysOpen) {
						_.each(templateData.days, function(val) {
							if (val.name !== 'MainSaturday' && val.name !== 'MainSunday') {
								val.open = true;
								val.from = is12hMode ? '9:00AM' : '9:00';
								val.to = is12hMode ? '5:00PM' : '17:00';
							}
						});
					}

					template = $(self.getTemplate({
						name: 'strategy-' + templateName,
						data: templateData,
						submodule: 'strategy'
					}));

					var validationOptions = {
						rules: {
							'lunchbreak.from': {},
							'lunchbreak.to': {
								greaterDate: template.find('input[name="lunchbreak.from"]')
							}
						},
						groups: {
							lunchbreak: 'lunchbreak.from lunchbreak.to'
						},
						errorPlacement: function(error, element) {
							error.appendTo(element.parent());
						}
					};

					if (is12hMode) {
						validationOptions.rules['lunchbreak.from'].time12h = true;
						validationOptions.rules['lunchbreak.to'].time12h = true;
					} else {
						validationOptions.rules['lunchbreak.from'].time24h = true;
						validationOptions.rules['lunchbreak.to'].time24h = true;
					}

					_.each(self.weekdayLabels, function(wday) {
						validationOptions.rules['weekdays.' + wday + '.from'] = {};
						validationOptions.rules['weekdays.' + wday + '.to'] = {
							greaterDate: template.find('input[name="weekdays.' + wday + '.from"]')
						};
						if (is12hMode) {
							validationOptions.rules['weekdays.' + wday + '.from'].time12h = true;
							validationOptions.rules['weekdays.' + wday + '.to'].time12h = true;
						} else {
							validationOptions.rules['weekdays.' + wday + '.from'].time24h = true;
							validationOptions.rules['weekdays.' + wday + '.to'].time24h = true;
						}
						validationOptions.groups[wday] = 'weekdays.' + wday + '.from weekdays.' + wday + '.to';
					});

					monster.ui.validate(template.find('#strategy_custom_hours_form'), validationOptions);

					$container
						.find('.element-content')
							.empty()
							.append(template);

					monster.ui.timepicker(template.find('.timepicker'));

					callback && callback();

					break;
				case 'holidays':
					var templateData = {
							enabled: !$.isEmptyObject(strategyData.temporalRules.holidays)
						},
						template = $(self.getTemplate({
							name: 'strategy-' + templateName,
							data: templateData,
							submodule: 'strategy'
						})),
						holidayList = template.find('.holidays-list');

					$container
						.find('.element-content')
							.empty()
							.append(template);

					holidayList.empty();

					_.each(strategyData.temporalRules.holidays, function(val, key) {
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

							self.strategyRenderHolidayLine(holidayList, holidayType, holidayData);
						}
					});

					callback && callback();

					break;
				case 'calls':
					var templateData = {
							lunchbreak: (strategyData.temporalRules.lunchbreak.id in strategyData.callflows.MainCallflow.flow.children),
							holidays: !$.isEmptyObject(strategyData.temporalRules.holidays),
							afterhours: false
						},
						template;

					_.each(self.weekdayLabels, function(val) {
						if (strategyData.temporalRules.weekdays[val].id in strategyData.callflows.MainCallflow.flow.children) {
							templateData.afterhours = true;
						}
					});

					template = $(self.getTemplate({
						name: 'strategy-' + templateName,
						data: templateData,
						submodule: 'strategy'
					}));

					$container
						.find('.element-content')
							.empty()
							.append(template);

					$.each(template.find('.callflow-tab'), function() {
						var $this = $(this),
							callflowName = $this.data('callflow'),
							menuName = callflowName + 'Menu',
							tabData = {
								callOption: {
									type: 'default'
								},
								hideAdvancedCallflows: _.isEmpty(strategyData.callEntities.advancedCallflows),
								callflow: callflowName,
								callEntities: self.strategyGetCallEntitiesDropdownData(strategyData.callEntities, true, true),
								voicemails: strategyData.voicemails,
								tabMessage: self.i18n.active().strategy.calls.callTabsMessages[callflowName]
							};

						if (strategyData.callflows[callflowName].flow.hasOwnProperty('is_main_number_cf')) {
							tabData.callOption.callEntityId = strategyData.callflows[callflowName].flow.data.id;
							tabData.callOption.type = 'advanced-callflow';
						} else if (strategyData.callflows[callflowName].flow.module === 'voicemail') {
							tabData.callOption.callEntityId = 'none';
							tabData.callOption.voicemailId = strategyData.callflows[callflowName].flow.data.id;
							tabData.callOption.type = 'user-voicemail';
						} else if (!_.isEmpty(strategyData.callflows[callflowName].flow.children)) {
							tabData.callOption.callEntityId = strategyData.callflows[callflowName].flow.data.id;
							if ('_' in strategyData.callflows[callflowName].flow.children
							&& strategyData.callflows[callflowName].flow.children._.module === 'voicemail') {
								tabData.callOption.type = 'user-voicemail';
								tabData.callOption.voicemailId = strategyData.callflows[callflowName].flow.children._.data.id;
							} else {
								tabData.callOption.type = 'user-menu';
							}
						}

						if (menuName in strategyData.callflows) {
							tabData.menu = menuName;
						}

						$(this)
							.empty()
								.append($(self.getTemplate({
									name: 'callsTab',
									data: tabData,
									submodule: 'strategy'
								})));
					});

					$.each(template.find('.user-select select'), function() {
						var $this = $(this);
						monster.ui.chosen($this, {
							width: '160px'
						});
						$this.siblings('.title').text($this.find('option:selected').closest('optgroup').prop('label'));
					});

					monster.ui.chosen(template.find('.voicemail-select select'), {
						width: '160px'
					});

					monster.ui.chosen(template.find('.advancedCallflows-select select'), {
						width: '160px'
					});

					callback && callback();

					break;
				default:
					callback && callback();

					break;
			}
		},

		/**
		 * Refresh main numbers strategy template
		 * @param  {Object}   args
		 * @param  {jQuery}   args.container                   Container template
		 * @param  {Object}   args.strategyData                Strategy data
		 * @param  {Object}   args.templateName                Template name
		 * @param  {Function} [args.callback]                  Optional callback to execute after refresh
		 */
		strategyRefreshTemplateNumbers: function(args) {
			var self = this,
				$container = args.container,
				strategyData = args.strategyData,
				templateName = args.templateName,
				callback = args.callback;

			self.strategyListAccountNumbers(function(accountNumbers) {
				var callflow = strategyData.callflows.MainCallflow,
					templateData = {
						hideBuyNumbers: _.has(monster.config.whitelabel, 'hideBuyNumbers')
							? monster.config.whitelabel.hideBuyNumbers
							: false,
						numbers: _.map(self.strategyExtractMainNumbers({
							mainCallflow: callflow
						}), function(val) {
							var ret = {
								number: {
									id: val
								}
							};

							if (_.has(accountNumbers, val)) {
								ret.number = _.merge(accountNumbers[val], ret.number);
							}

							return ret;
						}),
						spareLinkEnabled: (_.countBy(accountNumbers, function(number) { return number.used_by ? 'assigned' : 'spare'; }).spare > 0)
					},
					template = $(self.getTemplate({
						name: 'strategy-' + templateName,
						data: templateData,
						submodule: 'strategy'
					})),
					afterFeatureUpdate = function afterFeatureUpdate(numberId, numberFeatures, callbacks) {
						if (numberId) {
							monster.ui.paintNumberFeaturesIcon(numberFeatures, template.find('[data-phonenumber="' + numberId + '"] .features'));
						}

						self.strategyCheckIfUpdateEmergencyCallerID({
							templateNumbers: templateData.numbers,
							features: numberFeatures,
							number: numberId,
							callbacks: callbacks
						});
					};

				_.each(templateData.numbers, function(data) {
					data.number.phoneNumber = data.number.id;

					var numberData = data.number,
						args = {
							target: template.find('[data-phonenumber="' + numberData.id + '"] .edit-features'),
							numberData: numberData,
							afterUpdate: function(features) {
								afterFeatureUpdate(numberData.id, features);
							}
						};

					monster.pub('common.numberFeaturesMenu.render', args);
				});

				monster.ui.tooltips(template);

				$container
					.find('.element-content')
					.empty()
					.append(template);

				callback && callback();
			});
		},

		/**
		 * Changes a caller ID for the current account
		 * @param  {Object}   args
		 * @param  {('emergency'|'external')}  args.callerIdType  Caller ID type: emergency, external
		 * @param  {String}   args.number     Number to be set for emergency calls
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		strategyChangeCallerId: function(args) {
			var self = this,
				callerIdType = args.callerIdType,
				number = args.number;

			monster.waterfall([
				function(callback) {
					self.strategyGetAccount({
						success: function(data) {
							callback(null, data);
						},
						error: function(parsedError) {
							callback(parsedError);
						}
					});
				},
				function(data, callback) {
					data.caller_id = data.caller_id || {};
					data.caller_id[callerIdType] = data.caller_id[callerIdType] || {};
					data.caller_id[callerIdType].number = number;

					self.strategyUpdateAccount({
						data: data,
						success: function() {
							callback(null);
						},
						error: function(parsedError) {
							callback(parsedError);
						}
					});
				}
			], function(err) {
				if (err) {
					_.has(args, 'error') && args.error(err);
				} else {
					_.has(args, 'success') && args.success(number);
				}
			});
		},

		strategyNumbersBindEvents: function(container, strategyData) {
			var self = this,
				addNumbersToMainCallflow = function(numbers) {
					if (_.isEmpty(numbers)) {
						return;
					}

					var mainCallflow = strategyData.callflows.MainCallflow,
						indexPlaceholder = mainCallflow.numbers.indexOf('undefinedMainNumber');

					if (indexPlaceholder >= 0) {
						mainCallflow.numbers[indexPlaceholder] = '0';
					}

					mainCallflow.numbers = mainCallflow.numbers.concat(numbers);

					self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
						strategyData.callflows.MainCallflow = updatedCallflow;
						refreshNumbersTemplate();

						self.strategyCheckIfSetExternalCallerID({
							numbers: self.strategyExtractMainNumbers({
								mainCallflow: updatedCallflow
							})
						});
					});
				},
				refreshNumbersTemplate = function() {
					var mainCallflow = strategyData.callflows.MainCallflow,
						parentContainer = container.parents('.element-container'),
						headerSpan = parentContainer.find('.element-header-inner .summary > span');

					// Refresh headers
					if (mainCallflow.numbers.length > 1) {
						headerSpan.html(monster.util.formatPhoneNumber(mainCallflow.numbers[1]));
						if (mainCallflow.numbers.length > 3) {
							headerSpan.append('<i class="icon-telicon-multiple-items icon-small"></i>');
						} else if (mainCallflow.numbers.length === 3) {
							headerSpan.append(', ' + monster.util.formatPhoneNumber(mainCallflow.numbers[2]));
						}
						container.parents('#strategy_container').find('.element-container:not(.main-number,.strategy-confnum)').show();
						container.parents('#strategy_container').find('.element-container:not(.main-number,.strategy-faxingnum)').show();
						container.parents('#strategy_container').find('.element-container.helper').hide();
						container.parents('#strategy_container').find('.element-container.main-number').css('margin-top', '0px');

						self.strategyCheckSecondWalkthrough();
					} else {
						headerSpan.html(self.i18n.active().strategy.noNumberTitle);
						container.parents('#strategy_container').find('.element-container:not(.main-number,.strategy-confnum)').hide();
						container.parents('#strategy_container').find('.element-container:not(.main-number,.strategy-faxingnum)').hide();
						container.parents('#strategy_container').find('.element-container.helper').show();
						container.parents('#strategy_container').find('.element-container.main-number').css('margin-top', '10px');
					}

					// Refresh template
					self.strategyRefreshTemplate({
						container: parentContainer,
						strategyData: strategyData
					});
				};

			container.on('click', '.action-links .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var args = {
					accountName: monster.apps.auth.currentAccount.name,
					accountId: self.accountId,
					callback: function(numberList) {
						var numbers = _.map(numberList, function(val) {
							return val.phoneNumber;
						});
						addNumbersToMainCallflow(numbers);
					}
				};

				monster.pub('common.numbers.dialogSpare', args);
			});

			container.on('click', '.action-links .buy-link', function(e) {
				e.preventDefault();
				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
					callbacks: {
						success: function(numbers) {
							addNumbersToMainCallflow(_.keys(numbers));
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active().strategy.toastrMessages.buyNumbersSuccess
							});
						},
						error: function(error) {
							monster.ui.toast({
								type: 'error',
								message: self.i18n.active().strategy.toastrMessages.buyNumbersError
							});
						}
					}
				});
			});

			container.on('click', '.action-links .port-link', function(e) {
				e.preventDefault();
			});

			container.on('click', '.number-element .remove-number', function(e) {
				e.preventDefault();
				var $this = $(this),
					numberToRemove = $this.data('number'),
					e911Feature = $this.data('e911'),
					isE911Enabled = monster.util.isNumberFeatureEnabled('e911'),
					indexToRemove = strategyData.callflows.MainCallflow.numbers.indexOf(numberToRemove.toString());

				if (e911Feature === 'active' && container.find('.number-element .features .feature-e911').length === 1 && isE911Enabled) {
					monster.ui.alert('error', self.i18n.active().strategy.alertMessages.lastE911Error);
				} else if (indexToRemove >= 0) {
					self.strategyGetNumber(numberToRemove, function(dataNumber) {
						var dataTemplate = { phoneNumber: numberToRemove },
							featureList = [],
							popupHtml,
							popup,
							updateCallflow = function() {
								monster.waterfall([
									function(callback) {
										strategyData.callflows.MainCallflow.numbers.splice(indexToRemove, 1);

										// We don't want the '0' to stay in the routing system if they're no longer using SmartPBX.
										// If they remove their last main number, we consider they don't use SmartPBX, so we reset the "0" to be the "undefinedMainNumber"
										if (strategyData.callflows.MainCallflow.numbers.length === 1 && strategyData.callflows.MainCallflow.numbers[0] === '0') {
											strategyData.callflows.MainCallflow.numbers[0] = 'undefinedMainNumber';
										}

										self.strategyUpdateCallflow(strategyData.callflows.MainCallflow, function(updatedCallflow) {
											callback(null, updatedCallflow);
										});
									},
									function(updatedCallflow, callback) {
										monster.ui.toast({
											type: 'success',
											message: self.i18n.active().strategy.toastrMessages.removeNumberSuccess
										});
										strategyData.callflows.MainCallflow = updatedCallflow;
										refreshNumbersTemplate();

										self.strategyGetAccount({
											success: function(accountData) {
												callback(null, accountData);
											}
										});
									}
								], function(err, accountData) {
									if (err) {
										return;
									}

									var modified = false;

									// TODO: Maybe before unsetting external caller_id, ask user to choose another, if any other number is available
									if (_.get(accountData, 'caller_id.external.number') === numberToRemove) {
										delete accountData.caller_id.external;
										modified = true;
									}
									if (_.get(accountData, 'caller_id.emergency.number') === numberToRemove) {
										delete accountData.caller_id.emergency;
										modified = true;
									}

									if (modified) {
										self.strategyUpdateAccount({
											data: accountData
										});
									}
								});
							};

						_.each(dataNumber, function(val, idx) {
							if (idx === 'cnam' || idx === 'e911') {
								featureList.push({
									name: idx,
									friendlyName: self.i18n.active().strategy.popupRemoveFeatures.features[idx]
								});
							}
						});

						if (featureList.length > 0) {
							dataTemplate.featureList = featureList;
							popupHtml = $(self.getTemplate({
								name: 'popupRemoveFeatures',
								data: dataTemplate,
								submodule: 'strategy'
							}));

							popup = monster.ui.dialog(popupHtml, {
								title: self.i18n.active().strategy.popupRemoveFeatures.title,
								width: '540px'
							});

							popup.find('.cancel-link').on('click', function() {
								popup.dialog('close');
							});

							popup.find('#remove_features').on('click', function() {
								popup.find('.table td').each(function(idx, elem) {
									if ($(elem).find('input').is(':checked')) {
										delete dataNumber[$(elem).data('name')];
									}
								});

								self.strategyUpdateNumber(numberToRemove, dataNumber, function() {
									popup.dialog('close');

									updateCallflow();
								});
							});
						} else {
							updateCallflow();
						}
					});
				}
			});
		},

		strategyConfNumBindEvents: function(container, strategyData) {
			var self = this,
				addNumbersToMainConference = function(numbers) {
					if (numbers.length) {
						var mainConference = strategyData.callflows.MainConference;
						if (mainConference.numbers.length <= 1
						&& mainConference.numbers[0] === 'undefinedconf') {
							mainConference.numbers = [];
						}
						mainConference.numbers = mainConference.numbers.concat(numbers);
						self.strategyUpdateCallflow(mainConference, function(updatedCallflow) {
							var parentContainer = container.parents('.element-container');
							strategyData.callflows.MainConference = updatedCallflow;
							refreshConfNumHeader(parentContainer);
							self.strategyRefreshTemplate({
								container: parentContainer,
								strategyData: strategyData
							});
						});
					}
				},
				refreshConfNumHeader = function(parentContainer) {
					var mainConference = strategyData.callflows.MainConference,
						headerSpan = parentContainer.find('.element-header-inner .summary > span');
					if (mainConference.numbers.length > 0 && mainConference.numbers[0] !== 'undefinedconf') {
						headerSpan.html(monster.util.formatPhoneNumber(mainConference.numbers[0]));
						if (mainConference.numbers.length > 2) {
							headerSpan.append('<i class="icon-telicon-multiple-items icon-small"></i>');
						} else if (mainConference.numbers.length === 2) {
							headerSpan.append(', ' + monster.util.formatPhoneNumber(mainConference.numbers[1]));
						}
					} else {
						headerSpan.html(self.i18n.active().strategy.noNumberTitle);
					}
				};

			container.on('click', '.action-links .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var args = {
					accountName: monster.apps.auth.currentAccount.name,
					accountId: self.accountId,
					callback: function(numberList) {
						var numbers = $.map(numberList, function(val) {
							return val.phoneNumber;
						});
						addNumbersToMainConference(numbers);
					}
				};

				monster.pub('common.numbers.dialogSpare', args);
			});

			container.on('click', '.action-links .greeting-link', function(e) {
				e.preventDefault();
				var confCallflow = strategyData.callflows.MainConference;
				if (confCallflow) {
					self.strategyGetMainConferenceGreetingMedia(confCallflow, function(greetingMedia) {
						var greetingTemplate = $(self.getTemplate({
								name: 'customConferenceGreeting',
								data: {
									enabled: ('welcome_prompt' in confCallflow.flow.data),
									greeting: greetingMedia && greetingMedia.tts
										? greetingMedia.tts.text
										: ''
								},
								submodule: 'strategy'
							})),
							greetingPopup = monster.ui.dialog(greetingTemplate, {
								title: self.i18n.active().strategy.customConferenceGreeting.title,
								position: ['center', 20]
							});

						greetingTemplate.find('.switch-state').on('change', function() {
							$(this).prop('checked') ? greetingTemplate.find('.content').slideDown() : greetingTemplate.find('.content').slideUp();
						});

						greetingTemplate.find('.cancel').on('click', function() {
							greetingPopup.dialog('close').remove();
						});

						greetingTemplate.find('.save').on('click', function() {
							if (greetingTemplate.find('.switch-state').prop('checked')) {
								var updateMedia = function(callback) {
									if (greetingMedia) {
										greetingMedia.description = '<Text to Speech>';
										greetingMedia.media_source = 'tts';
										greetingMedia.tts = {
											text: greetingTemplate.find('.custom-greeting-text').val(),
											voice: 'female/en-US'
										};

										self.callApi({
											resource: 'media.update',
											data: {
												accountId: self.accountId,
												mediaId: greetingMedia.id,
												data: greetingMedia
											},
											success: function(data, status) {
												callback && callback(data.data);
											}
										});
									} else {
										self.callApi({
											resource: 'media.create',
											data: {
												accountId: self.accountId,
												data: {
													description: '<Text to Speech>',
													media_source: 'tts',
													name: 'MainConferenceGreeting',
													streamable: true,
													type: 'mainConfGreeting',
													tts: {
														text: greetingTemplate.find('.custom-greeting-text').val(),
														voice: 'female/en-US'
													}
												}
											},
											success: function(data, status) {
												callback && callback(data.data);
											}
										});
									}
								};

								updateMedia(function(updatedGreeting) {
									confCallflow.flow.data.welcome_prompt = {
										media_id: updatedGreeting.id
									};
									self.strategyUpdateCallflow(confCallflow, function(updatedCallflow) {
										strategyData.callflows.MainConference = updatedCallflow;
										greetingPopup.dialog('close').remove();
										$('#strategy_container .custom-greeting-icon').show();
									});
								});
							} else {
								if ('welcome_prompt' in confCallflow.flow.data) {
									delete confCallflow.flow.data.welcome_prompt;
									self.strategyUpdateCallflow(confCallflow, function(updatedCallflow) {
										strategyData.callflows.MainConference = updatedCallflow;
										greetingPopup.dialog('close').remove();
										$('#strategy_container .custom-greeting-icon').hide();
									});
								} else {
									greetingPopup.dialog('close').remove();
								}
							}
						});
					});
				} else {
					monster.ui.alert('error', self.i18n.active().strategy.customConferenceGreeting.mainConfMissing);
				}
			});

			container.on('click', '.action-links .buy-link', function(e) {
				e.preventDefault();
				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
					callbacks: {
						success: function(numbers) {
							addNumbersToMainConference(_.keys(numbers));
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active().strategy.toastrMessages.buyNumbersSuccess
							});
						},
						error: function(error) {
							monster.ui.toast({
								type: 'error',
								message: self.i18n.active().strategy.toastrMessages.buyNumbersError
							});
						}
					}
				});
			});

			container.on('click', '.number-element .remove-number', function(e) {
				e.preventDefault();
				var numberToRemove = $(this).data('number').toString(),
					indexToRemove = strategyData.callflows.MainConference.numbers.indexOf(numberToRemove);

				if (indexToRemove >= 0) {
					strategyData.callflows.MainConference.numbers.splice(indexToRemove, 1);

					if (strategyData.callflows.MainConference.numbers.length === 0) {
						strategyData.callflows.MainConference.numbers = ['undefinedconf'];
					}

					self.strategyUpdateCallflow(strategyData.callflows.MainConference, function(updatedCallflow) {
						var parentContainer = container.parents('.element-container');
						monster.ui.toast({
							type: 'success',
							message: self.i18n.active().strategy.toastrMessages.removeNumberSuccess
						});
						strategyData.callflows.MainConference = updatedCallflow;
						refreshConfNumHeader(parentContainer);
						self.strategyRefreshTemplate({
							container: parentContainer,
							strategyData: strategyData
						});
					});
				}
			});
		},

		strategyGetMainConferenceGreetingMedia: function(mainConferenceCallflow, callback) {
			var self = this,
				mediaId = _.get(mainConferenceCallflow, 'flow.data.welcome_prompt.media_id');

			monster.waterfall([
				function(cb) {
					if (_.isUndefined(mediaId)) {
						return cb(null, null);
					}
					self.callApi({
						resource: 'media.get',
						data: {
							accountId: self.accountId,
							mediaId: mediaId
						},
						success: function(data) {
							cb(null, data.data);
						},
						error: function() {
							cb(true);
						}
					});
				}
			], function(err, media) {
				callback(err ? null : media);
			});
		},

		strategyFaxingNumBindEvents: function(container, strategyData) {
			var self = this,
				addNumbersToMainFaxing = function(numbers) {
					if (numbers.length) {
						var mainFaxing = strategyData.callflows.MainFaxing,
							updateCallflow = function() {
								self.strategyUpdateCallflow(mainFaxing, function(updatedCallflow) {
									var parentContainer = container.parents('.element-container');
									strategyData.callflows.MainFaxing = updatedCallflow;
									refreshFaxingNumHeader(parentContainer);
									self.strategyRefreshTemplate({
										container: parentContainer,
										strategyData: strategyData
									});
								});
							};

						if (mainFaxing.numbers.length <= 1 && mainFaxing.numbers[0] === 'undefinedfaxing') {
							mainFaxing.numbers = [];
						}
						mainFaxing.numbers = mainFaxing.numbers.concat(numbers);
						if (mainFaxing.flow.data.hasOwnProperty('id')) {
							updateCallflow();
						} else {
							var template = $(self.getTemplate({
									name: 'popupEditFaxbox',
									submodule: 'strategy'
								})),
								popup = monster.ui.dialog(template, {
									title: self.i18n.active().strategy.popupEditFaxbox.titles.create,
									position: ['center', 20],
									hideClose: true
								});

							template
								.find('.cancel-link')
									.on('click', function(event) {
										event.preventDefault();

										popup.dialog('close').remove();
									});

							template
								.find('.save')
									.on('click', function(event) {
										event.preventDefault();

										var $form = template.find('#faxbox_form'),
											email = monster.ui.getFormData('faxbox_form').email;

										monster.ui.validate($form, {
											rules: {
												email: {
													required: true,
													email: true
												}
											}
										});

										if (monster.ui.valid($form)) {
											popup.dialog('close').remove();

											self.strategyBuildFaxbox({
												data: {
													email: email,
													number: mainFaxing.numbers[0]
												},
												success: function(data) {
													mainFaxing.flow.data.id = data.id;
													updateCallflow();
												}
											});
										}
									});
						}
					}
				},
				refreshFaxingNumHeader = function(parentContainer) {
					var mainFaxing = strategyData.callflows.MainFaxing,
						headerSpan = parentContainer.find('.element-header-inner .summary > span');
					if (mainFaxing.numbers.length > 0 && mainFaxing.numbers[0] !== 'undefinedfaxing') {
						headerSpan.html(monster.util.formatPhoneNumber(mainFaxing.numbers[0]));
						if (mainFaxing.numbers.length > 2) {
							headerSpan.append('<i class="icon-telicon-multiple-items icon-small"></i>');
						} else if (mainFaxing.numbers.length === 2) {
							headerSpan.append(', ' + monster.util.formatPhoneNumber(mainFaxing.numbers[1]));
						}
					} else {
						headerSpan.html(self.i18n.active().strategy.noNumberTitle);
					}
				};

			container.on('click', '.action-links .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var args = {
					accountName: monster.apps.auth.currentAccount.name,
					accountId: self.accountId,
					singleSelect: true,
					callback: function(numberList) {
						var numbers = $.map(numberList, function(val) {
							return val.phoneNumber;
						});
						addNumbersToMainFaxing(numbers);
					}
				};

				monster.pub('common.numbers.dialogSpare', args);
			});

			container.on('click', '.action-links .edit-email', function(e) {
				e.preventDefault();

				monster.waterfall([
					function(callback) {
						self.strategyGetFaxbox({
							data: {
								faxboxId: strategyData.callflows.MainFaxing.flow.data.id
							},
							success: function(faxbox) {
								var template = $(self.getTemplate({
										name: 'popupEditFaxbox',
										data: {
											email: faxbox.hasOwnProperty('notifications') && faxbox.notifications.hasOwnProperty('inbound') && faxbox.notifications.inbound.hasOwnProperty('email')
												? faxbox.notifications.inbound.email.send_to
												: ''
										},
										submodule: 'strategy'
									})),
									popup = monster.ui.dialog(template, {
										title: self.i18n.active().strategy.popupEditFaxbox.titles.edit,
										position: ['center', 20]
									});

								template
									.find('.cancel-link')
										.on('click', function(event) {
											event.preventDefault();

											popup.dialog('close').remove();

											callback(true, null);
										});

								template
									.find('.save')
										.on('click', function(event) {
											event.preventDefault();

											var $form = template.find('#faxbox_form'),
												email = monster.ui.getFormData('faxbox_form').email;

											monster.ui.validate($form, {
												rules: {
													email: {
														required: true,
														email: true
													}
												}
											});

											if (monster.ui.valid($form)) {
												popup.dialog('close').remove();

												callback(null, _.extend(faxbox, {
													notifications: {
														inbound: {
															email: {
																send_to: email
															}
														}
													}
												}));
											}
										});
							}
						});
					},
					function(faxboxData, callback) {
						self.strategyUpdateFaxbox({
							data: {
								faxboxId: faxboxData.id,
								data: faxboxData
							},
							success: function(updatedFaxbox) {
								callback(null, updatedFaxbox);
							}
						});
					}
				], function(err, results) {
					if (!err) {
						monster.ui.toast({
							type: 'success',
							message: 'Main Fabox Email Successfully Changed'
						});
					}
				});
			});

			container.on('click', '.action-links .buy-link', function(e) {
				e.preventDefault();
				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
					singleSelect: true,
					callbacks: {
						success: function(numbers) {
							addNumbersToMainFaxing(_.keys(numbers));
							monster.ui.toast({
								type: 'success',
								message: self.i18n.active().strategy.toastrMessages.buyNumbersSuccess
							});
						},
						error: function(error) {
							monster.ui.toast({
								type: 'error',
								message: self.i18n.active().strategy.toastrMessages.buyNumbersError
							});
						}
					}
				});
			});

			container.on('click', '.number-element .remove-number', function(e) {
				e.preventDefault();
				var numberToRemove = $(this).data('number'),
					mainFaxing = strategyData.callflows.MainFaxing,
					indexToRemove = mainFaxing.numbers.indexOf(numberToRemove);

				if (indexToRemove >= 0) {
					mainFaxing.numbers.splice(indexToRemove, 1);
					if (mainFaxing.numbers.length === 0) {
						mainFaxing.numbers = ['undefinedfaxing'];
					}
					self.strategyDeleteFaxbox({
						data: {
							id: mainFaxing.flow.data.id
						},
						success: function(data) {
							delete mainFaxing.flow.data.id;
							self.strategyUpdateCallflow(mainFaxing, function(updatedCallflow) {
								var parentContainer = container.parents('.element-container');
								monster.ui.toast({
									type: 'success',
									message: self.i18n.active().strategy.toastrMessages.removeNumberSuccess
								});
								strategyData.callflows.MainFaxing = updatedCallflow;
								refreshFaxingNumHeader(parentContainer);
								self.strategyRefreshTemplate({
									container: parentContainer,
									strategyData: strategyData
								});
							});
						}
					});
				}
			});
		},

		strategyHoursBindEvents: function(container, strategyData) {
			var self = this;

			container.on('change', '.custom-hours-toggler input[type="radio"]', function(e) {
				var toggleDiv = container.find('.custom-hours-div');
				if ($(this).val() === 'true') {
					toggleDiv.slideDown();
				} else {
					toggleDiv.slideUp();
				}
			});

			container.on('change', '.custom-days input[type="checkbox"]', function(e) {
				var parent = $(this).parents('.custom-day'),
					timepickers = parent.find('.timepickers'),
					status = parent.find('.status');
				if ($(this).prop('checked')) {
					timepickers.fadeIn(200);
					status.fadeOut(100, function() {
						status.html(self.i18n.active().strategy.open);
						status.fadeIn(100);
					});
				} else {
					timepickers.fadeOut(200);
					status.fadeOut(100, function() {
						status.html(self.i18n.active().strategy.closed);
						status.fadeIn(100);
					});
				}
			});

			container.on('change', '.custom-hours-lunchbreak input[type="checkbox"]', function(e) {
				if ($(this).prop('checked')) {
					$(this).parents('.custom-hours-lunchbreak').find('.timepickers').fadeIn(200);
				} else {
					$(this).parents('.custom-hours-lunchbreak').find('.timepickers').fadeOut(200);
				}
			});

			container.on('click', '.save-button', function(e) {
				e.preventDefault();

				if (monster.ui.valid(container.find('#strategy_custom_hours_form'))) {
					var parent = $(this).parents('.element-container'),
						customHours = monster.ui.getFormData('strategy_custom_hours_form'),
						mainCallflow = strategyData.callflows.MainCallflow,
						formatChildModule = function(callflowId) {
							return {
								children: {},
								data: {
									id: callflowId
								},
								module: 'callflow'
							};
						};

					_.each(strategyData.temporalRules.weekdays, function(val, key) {
						delete mainCallflow.flow.children[val.id];
					});
					delete mainCallflow.flow.children[strategyData.temporalRules.lunchbreak.id];

					if (customHours.enabled === 'false' || !customHours.opendays || customHours.opendays.length === 0) {
						mainCallflow.flow.children._ = formatChildModule(strategyData.callflows.MainOpenHours.id);
					} else {
						var tmpRulesRequests = {};

						mainCallflow.flow.children._ = formatChildModule(strategyData.callflows.MainAfterHours.id);

						if (customHours.lunchbreak.enabled) {
							var lunchbreakRule = strategyData.temporalRules.lunchbreak;

							_.assign(lunchbreakRule, {
								wdays: _.map(customHours.opendays, function(item) {
									// make sure the lunch rule is only valid on days the business is open
									return _
										.chain(item)
										.toLower()
										.replace(/^main/, '')
										.value();
								}),
								time_window_start: monster.util.timeToSeconds(customHours.lunchbreak.from),
								time_window_stop: monster.util.timeToSeconds(customHours.lunchbreak.to)
							});

							tmpRulesRequests.lunchbreak = function(callback) {
								self.callApi({
									resource: 'temporalRule.update',
									data: {
										accountId: self.accountId,
										ruleId: lunchbreakRule.id,
										data: lunchbreakRule
									},
									success: function(data, status) {
										callback(null, data.data);
									}
								});
							};

							mainCallflow.flow.children[lunchbreakRule.id] = formatChildModule(strategyData.callflows.MainLunchHours.id);
						}

						_.each(customHours.opendays, function(val) {
							var temporalRule = strategyData.temporalRules.weekdays[val];
							temporalRule.time_window_start = monster.util.timeToSeconds(customHours.weekdays[val].from);
							temporalRule.time_window_stop = monster.util.timeToSeconds(customHours.weekdays[val].to);
							tmpRulesRequests[val] = function(callback) {
								self.callApi({
									resource: 'temporalRule.update',
									data: {
										accountId: self.accountId,
										ruleId: temporalRule.id,
										data: temporalRule
									},
									success: function(data, status) {
										callback(null, data.data);
									}
								});
							};

							mainCallflow.flow.children[temporalRule.id] = formatChildModule(strategyData.callflows.MainOpenHours.id);
						});

						monster.parallel(tmpRulesRequests, function(err, results) {});
					}

					self.strategyRebuildMainCallflowRuleArray(strategyData);
					self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
						strategyData.callflows.MainCallflow = updatedCallflow;
						parent.find('.element-content').hide();
						parent.removeClass('open');
					});
				}
			});
		},

		strategyHolidaysBindEvents: function(container, strategyData) {
			var self = this;

			container.on('change', '.holidays-toggler input[type="checkbox"]', function(e) {
				if ($(this).prop('checked')) {
					container.find('.holidays-div').slideDown();
				} else {
					container.find('.holidays-div').slideUp();
				}
			});

			container.on('click', '.add-holidays-link', function(e) {
				e.preventDefault();
				self.strategyRenderHolidayLine(container.find('.holidays-list'), $(this).data('type'));
			});

			container.on('click', '.delete-holiday', function(e) {
				var holidaysElement = $(this).parents('.holidays-element'),
					id = holidaysElement.data('id'),
					type = holidaysElement.data('type');

				if (id) {
					monster.ui.confirm(self.i18n.active().strategy.confirmMessages.deleteHoliday, function() {
						var mainCallflow = strategyData.callflows.MainCallflow;
						delete mainCallflow.flow.children[id];

						self.strategyRebuildMainCallflowRuleArray(strategyData);
						self.strategyUpdateCallflow(mainCallflow, function(updatedCallflow) {
							strategyData.callflows.MainCallflow = updatedCallflow;
							var afterDelete = function(data) {
								delete strategyData.temporalRules.holidays[data.name];
								holidaysElement.remove();
							};

							if (type === 'set') {
								self.strategyDeleteRuleSetAndRules(id, afterDelete);
							} else {
								self.strategyDeleteHoliday(id, afterDelete);
							}
						});
					});
				} else {
					holidaysElement.remove();
				}
			});

			container.on('click', '.save-button', function(e) {
				e.preventDefault();
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
								strategyData.temporalRules.holidays[val.name] = val;
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
						_.each(strategyData.temporalRules.holidays, function(val, key) {
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
							strategyData.temporalRules.holidays = {};
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
				rulesToCreate = [ ],
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
		},

		strategyGetDetailRuleSet: function(id, globalCallback) {
			var self = this;

			self.strategyGetRuleSet(id, function(set) {
				var parallelRequests = {};

				_.each(set.temporal_rules, function(ruleId) {
					parallelRequests[ruleId] = function(callback) {
						self.strategyGetRule(ruleId, function(data) {
							if (data.hasOwnProperty('message') && data.message === 'bad identifier') {
								data = {};
							}
							callback && callback(null, data);
						});
					};
				});

				monster.parallel(parallelRequests, function(err, results) {
					var ruleDetails = [],
						listRules = [],
						viewData = {};

					_.each(set.temporal_rules, function(ruleId) {
						if (!_.isEmpty(results[ruleId])) {
							listRules.push(ruleId);
							ruleDetails.push(results[ruleId]);
						}
					});

					if (ruleDetails.length) {
						viewData.fromDay = ruleDetails[0].days[0];
						viewData.toDay = ruleDetails[ruleDetails.length - 1].days[ruleDetails[ruleDetails.length - 1].days.length - 1];
						viewData.fromMonth = ruleDetails[0].month;
						viewData.toMonth = ruleDetails[ruleDetails.length - 1].month;
					}

					// If list of actual existing rules isn't the same as the ones in the set, we'll update the set and remove the reference to non-existing rules.
					if (!_.isEqual(listRules, set.temporal_rules)) {
						// If there is at least one valid rule in the set
						if (listRules.length > 0) {
							set.temporal_rules = listRules;
							// We just want to update the list of rules
							self.strategyUpdateRuleSet(set, function(data) {
								data.viewData = viewData;

								globalCallback && globalCallback(data);
							});

						// Otherwise we delete the set
						} else {
							self.strategyDeleteRuleSet(set.id, function() {
								globalCallback && globalCallback({});
							});
						}
					} else {
						set.viewData = viewData;

						globalCallback && globalCallback(set);
					}
				});
			});
		},

		strategyGetRuleSet: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.get',
				data: {
					accountId: self.accountId,
					setId: id
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		strategyUpdateRuleSet: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.update',
				data: {
					accountId: self.accountId,
					setId: data.id,
					data: data
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		strategyCreateRuleSet: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalSet.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
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

		strategyBuildHolidayRule: function(container, rules) {
			var self = this,
				$this = $(container),
				name = $this.find('.name').val().trim(),
				month = parseInt($this.find('.month.from :selected').val()),
				toMonth = parseInt($this.find('.month.to :selected').val()),
				fromDay = parseInt($this.find('.day.from :selected').val()),
				toDay = parseInt($this.find('.day.to :selected').val()),
				ordinal = $this.find('.ordinal :selected').val(),
				wday = $this.find('.wday :selected').val(),
				id = $this.data('id'),
				type = $this.data('type'),
				holidayRule = {};

			if (!name || _.keys(rules).indexOf(name) >= 0) {
				holidayRule = false;
			} else if (toMonth && month !== toMonth) {
				holidayRule = {
					isRange: true,
					name: name,
					fromDay: fromDay,
					fromMonth: month,
					toDay: toDay,
					toMonth: toMonth
				};
			} else {
				holidayRule = {
					name: name,
					cycle: 'yearly',
					interval: 1,
					month: month,
					type: 'main_holidays'
				};

				if (fromDay) {
					var firstDay = fromDay;
					holidayRule.days = [firstDay];
					if (toDay) {
						for (var day = firstDay + 1; day <= toDay; day++) {
							holidayRule.days.push(day);
						}
					}
				} else {
					holidayRule.ordinal = ordinal;
					holidayRule.wdays = [wday];
				}
			}

			if (id) {
				holidayRule.id = id;
			}

			holidayRule.extra = {
				oldType: type
			};

			return holidayRule;
		},

		strategyUpdateHoliday: function(data, callback) {
			var self = this;

			if (data.id) {
				self.callApi({
					resource: 'temporalRule.update',
					data: {
						accountId: self.accountId,
						ruleId: data.id,
						data: data
					},
					success: function(data, status) {
						callback(data.data);
					}
				});
			} else {
				self.callApi({
					resource: 'temporalRule.create',
					data: {
						accountId: self.accountId,
						data: data
					},
					success: function(data, status) {
						callback(data.data);
					}
				});
			}
		},

		strategyDeleteHoliday: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.delete',
				data: {
					accountId: self.accountId,
					ruleId: id,
					generateError: false
				},
				success: function(data, status) {
					callback(data.data);
				},
				// Sometimes we'll try to delete a time of day which no longer exist, but still need to execute the callback
				error: function(data, status) {
					callback(data.data);
				}
			});
		},

		strategyCallsBindEvents: function(container, strategyData) {
			var self = this;

			container.on('click', '.calls-tabs a', function(e) {
				e.preventDefault();
				$(this).tab('show');
			});

			function selectCallOption(container) {
				container.siblings().removeClass('active');
				container.addClass('active');
			};

			container.on('click', '.call-option', function(e) {
				var $this = $(this);

				selectCallOption($this);

				$this.find('.radio-div input[type="radio"]').prop('checked', true);
			});

			container.on('change', 'input[type="radio"]', function(e) {
				if ($(this).prop('checked')) {
					selectCallOption($(this).parents('.call-option'));
				}
			});

			container.on('click', '.menu-div a', function(e) {
				e.preventDefault();
				var parentTab = $(this).parents('.callflow-tab');
				self.strategyShowMenuPopup({
					strategyData: strategyData,
					name: parentTab.data('callflow') + 'Menu',
					label: container.find('a[href="#' + parentTab.prop('id') + '"]').text()
				});
			});

			container.on('change', '.user-select select', function(e) {
				var $this = $(this);
				$this.siblings('.title').text($this.find('option:selected').closest('optgroup').prop('label'));
			});

			container.on('click', '.save-button', function(e) {
				e.preventDefault();
				var invalidTab = null,
					flows = {};

				$.each(container.find('.callflow-tab'), function() {
					var $this = $(this),
						callflowName = $this.data('callflow'),
						callOption = $this.find('.call-option.active'),
						menu = callOption.find('.menu-div'),
						callEntity = callOption.find('.user-select'),
						voicemail = callOption.find('.voicemail-select'),
						advancedCallflow = callOption.find('.advancedCallflows-select'),
						flow = {};

					if (callEntity.length) {
						var selectedEntity = callEntity.find('option:selected'),
							flowElement = {
								children: {},
								module: selectedEntity.data('type'),
								data: {}
							};
						switch (flowElement.module) {
							case 'user':
							case 'device':
							case 'callflow':
							case 'play':
								flowElement.data.id = selectedEntity.val();

								break;
							case 'ring_group':
								flowElement.data.endpoints = [{
									endpoint_type: 'group',
									id: selectedEntity.val()
								}];

								break;
							case 'none':
								flowElement = {};

								break;
							default:
								break;
						}

						flow = flowElement;
					}

					if (voicemail.length) {
						var selectedVoicemail = voicemail.find('option:selected'),
							flowElement = {
								children: {},
								module: 'voicemail',
								data: {
									id: selectedVoicemail.val()
								}
							};

						if ('children' in flow) {
							flow.children._ = flowElement;
						} else {
							flow = flowElement;
						}
					}

					if (menu.length) {
						var menuCallflowName = menu.data('callflow');
						if (!menuCallflowName) {
							invalidTab = this.id;
							return false;
						} else {
							var flowElement = {
								children: {},
								module: 'callflow',
								data: {
									id: strategyData.callflows[menuCallflowName].id
								}
							};

							if ('children' in flow) {
								flow.children._ = flowElement;
							} else {
								flow = flowElement;
							}
						}
					}

					if (advancedCallflow.length) {
						flow = {
							children: {},
							module: 'callflow',
							data: {
								id: advancedCallflow.find('option:selected').val()
							},
							is_main_number_cf: true
						};
					}

					flows[callflowName] = flow;
				});

				if (invalidTab) {
					monster.ui.alert(self.i18n.active().strategy.alertMessages.undefinedMenu);
					container.find('a[href="#' + invalidTab + '"]').tab('show');
				} else {
					var parallelRequests = {};
					_.each(flows, function(val, key) {
						strategyData.callflows[key].flow = val;
						parallelRequests[key] = function(callback) {
							self.strategyUpdateCallflow(strategyData.callflows[key], function(updatedCallflow) {
								strategyData.callflows[key] = updatedCallflow;
								callback(null, updatedCallflow);
							});
						};
					});

					monster.parallel(parallelRequests, function(err, results) {
						container.hide();
						container.parents('.element-container').removeClass('open');
						monster.ui.toast({
							type: 'success',
							message: self.i18n.active().strategy.toastrMessages.updateCallSuccess
						});
					});
				}
			});

			container.on('click', '.reset-button', function(e) {
				e.preventDefault();

				monster.ui.confirm(self.i18n.active().strategy.confirmMessages.resetCalls, function() {
					monster.waterfall([
						function(callback) {
							self.strategyGetSubCallStrategiesData(callback);
						},
						function(currentStrategiesData, callback) {
							self.strategyResetSubCallStrategies(_.merge({
								callback: callback
							}, currentStrategiesData));
						}
					], function(err, callflows) {
						if (err) {
							return;
						}

						// Update modified callflows on strategyData
						_.assign(strategyData.callflows, callflows);

						container.hide();
						container.parents('.element-container').removeClass('open');
						monster.ui.toast({
							type: 'success',
							message: self.i18n.active().strategy.toastrMessages.resetCallSuccess
						});
					});
				});
			});
		},

		strategyRenderHolidayLine: function(container, holidayType, holiday) {
			var self = this,
				templateData = $.extend(true, {
					resources: {
						months: [
							{ value: 1, label: self.i18n.active().strategy.monthsShort.january },
							{ value: 2, label: self.i18n.active().strategy.monthsShort.february },
							{ value: 3, label: self.i18n.active().strategy.monthsShort.march },
							{ value: 4, label: self.i18n.active().strategy.monthsShort.april },
							{ value: 5, label: self.i18n.active().strategy.monthsShort.may },
							{ value: 6, label: self.i18n.active().strategy.monthsShort.june },
							{ value: 7, label: self.i18n.active().strategy.monthsShort.july },
							{ value: 8, label: self.i18n.active().strategy.monthsShort.august },
							{ value: 9, label: self.i18n.active().strategy.monthsShort.september },
							{ value: 10, label: self.i18n.active().strategy.monthsShort.october },
							{ value: 11, label: self.i18n.active().strategy.monthsShort.november },
							{ value: 12, label: self.i18n.active().strategy.monthsShort.december }
						],
						days: [],
						wdays: $.map(self.weekdays, function(wday) {
							return {
								value: wday,
								label: self.i18n.active().strategy.weekdays[wday].substring(0, 3)
							};
						}),
						ordinals: [
							{ value: 'first', label: self.i18n.active().strategy.ordinals.first },
							{ value: 'second', label: self.i18n.active().strategy.ordinals.second },
							{ value: 'third', label: self.i18n.active().strategy.ordinals.third },
							{ value: 'fourth', label: self.i18n.active().strategy.ordinals.fourth },
							{ value: 'fifth', label: self.i18n.active().strategy.ordinals.fifth },
							{ value: 'last', label: self.i18n.active().strategy.ordinals.last }
						]
					}
				}, holiday, { holidayType: holidayType });

			for (var i = 1; i <= 31; i++) {
				templateData.resources.days.push({ value: i });
			}

			container
				.append($(self.getTemplate({
					name: 'holidayLine',
					data: templateData,
					submodule: 'strategy'
				})));
		},

		strategyShowMenuPopup: function(params) {
			var self = this,
				strategyData = params.strategyData,
				name = params.name,
				label = params.label,
				template, menu, greeting,
				showPopup = function() {
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId
						},
						success: function(response) {
							var greetingFiles,
								noGreetingFiles;
							if (response.data.length > 0) {
								greetingFiles = response.data;
							} else {
								noGreetingFiles = true;
							}

							template = $(self.getTemplate({
								name: 'menuPopup',
								data: {
									showMediaUploadDisclosure: monster.config.whitelabel.showMediaUploadDisclosure,
									menu: menu,
									greeting: greeting,
									greetingFiles: greetingFiles,
									noGreetingFiles: noGreetingFiles
								},
								submodule: 'strategy'
							}));

							var popup = monster.ui.dialog(template, {
								title: self.i18n.active().strategy.popup.title + ' - ' + label,
								dialogClass: 'overflow-visible'
							});

							var menuLineContainer = template.find('.menu-block .left .content'),
								popupCallEntities = $.extend(true, {}, strategyData.callEntities, { voicemail: strategyData.voicemails }, { directory: strategyData.directories }),
								dropdownCallEntities = self.strategyGetCallEntitiesDropdownData(popupCallEntities);

							_.each(strategyData.callflows[name].flow.children, function(val, key) {
								menuLineContainer
									.append($(self.getTemplate({
										name: 'menuLine',
										data: {
											number: key,
											callEntities: dropdownCallEntities,
											selectedId: val.data.id || val.data.endpoints[0].id
										},
										submodule: 'strategy'
									})));
							});

							$.each(menuLineContainer.find('.target-input'), function() {
								var $this = $(this),
									icon = $this.find('.target-select option:selected').parents('optgroup').data('icon');
								$this.find('.target-icon').addClass(icon);
							});

							self.strategyBindMenuPopupEvents(popup, $.extend({
								menu: menu,
								greeting: greeting
							}, params));
						}
					});
				};

			if (name in strategyData.callflows) {
				self.callApi({
					resource: 'menu.get',
					data: {
						accountId: self.accountId,
						menuId: strategyData.callflows[name].flow.data.id
					},
					success: function(data, status) {
						menu = data.data;
						if (menu.media.greeting) {
							self.callApi({
								resource: 'media.get',
								data: {
									accountId: self.accountId,
									mediaId: menu.media.greeting,
									generateError: false
								},
								success: function(data, status) {
									greeting = data.data;
									showPopup();
								},
								error: function(data, status, globalHandler) {
									if (data && data.error === '404') {
										showPopup();
										monster.ui.toast({
											type: 'warning',
											message: self.i18n.active().strategy.greetingMissing
										});
									} else {
										globalHandler(data, { generateError: true });
									}
								}
							});
						} else {
							showPopup();
						}
					}
				});
			} else {
				self.callApi({
					resource: 'menu.create',
					data: {
						accountId: self.accountId,
						data: {
							name: name,
							record_pin: monster.util.randomString(4, '1234567890'),
							media: {
								exit_media: true,
								invalid_media: true,
								transfer_media: true
							},
							retries: 3,
							max_extension_length: 4,
							type: 'main'
						}
					},
					success: function(data, status) {
						menu = data.data;
						self.callApi({
							resource: 'callflow.create',
							data: {
								accountId: self.accountId,
								data: {
									contact_list: {
										exclude: false
									},
									numbers: [name],
									type: 'main',
									flow: {
										children: {},
										data: {
											id: menu.id
										},
										module: 'menu'
									}
								}
							},
							success: function(data, status) {
								strategyData.callflows[name] = data.data;
								$('.callflow-tab.active .menu-div').data('callflow', name);
								$('.callflow-tab.active .menu-div').addClass('has-menu');
								showPopup();
							}
						});
					}
				});
			}
		},

		strategyBindMenuPopupEvents: function(popup, params) {
			var self = this,
				strategyData = params.strategyData,
				callflowName = params.name,
				menu = params.menu,
				greeting = params.greeting,
				container = popup.find('#strategy_menu_popup'),
				ttsGreeting = container.find('#strategy_menu_popup_tts_greeting'),
				uploadGreeting = container.find('#strategy_menu_popup_upload_greeting'),
				chooseExisting = container.find('#strategy_menu_popup_choose_existing'),
				mediaToUpload;

			monster.ui.chosen(container.find('.target-select'), {
				width: '150px'
			});

			container.find('.upload-input').fileUpload({
				inputOnly: true,
				wrapperClass: 'upload-container',
				btnText: self.i18n.active().strategy.popup.fileUploadButton,
				btnClass: 'monster-button-secondary',
				maxSize: 5,
				success: function(results) {
					mediaToUpload = results[0];
				},
				error: function(errors) {
					if (errors.hasOwnProperty('size') && errors.size.length > 0) {
						monster.ui.alert(self.i18n.active().strategy.alertMessages.fileTooBigAlert);
					}
					container.find('.upload-container input').val('');
					mediaToUpload = undefined;
				}
			});

			container.on('change', '.target-select', function(e) {
				var $this = $(this),
					iconElem = $this.parents('.target-input').find('.target-icon'),
					icon = $this.find('option:selected').parents('optgroup').data('icon');

				iconElem.attr('class', 'target-icon ' + icon);
			});

			container.on('click', '.remove-btn', function(e) {
				$(this).parents('.menu-line').remove();
			});

			container.find('.add-menu-line a').on('click', function(e) {
				e.preventDefault();
				var popupCallEntities = $.extend(true, {}, strategyData.callEntities, { voicemail: strategyData.voicemails }, { directory: strategyData.directories }),
					menuLine = $(self.getTemplate({
						name: 'menuLine',
						data: {
							callEntities: self.strategyGetCallEntitiesDropdownData(popupCallEntities)
						},
						submodule: 'strategy'
					})),
					icon = menuLine.find('.target-select option:selected').parents('optgroup').data('icon');

				container.find('.menu-block .left .content').append(menuLine);
				menuLine.find('.target-icon').addClass(icon);
				menuLine.find('.number-input').focus();
			});

			ttsGreeting.find('.update-greeting').on('click', function(e) {
				var text = ttsGreeting.find('textarea').val();
				if (text) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: callflowName + 'TTS',
								media_source: 'tts',
								description: '<Text to Speech>',
								tts: {
									voice: 'female/en-US',
									text: text
								}
							}
						},
						success: function(data, status) {
							greeting = data.data;
							menu.media.greeting = data.data.id;
							self.callApi({
								resource: 'menu.update',
								data: {
									accountId: self.accountId,
									menuId: menu.id,
									data: menu
								},
								success: function(data, status) {
									menu = data.data;
								}
							});

							container.find('.greeting-option').removeClass('active');
							ttsGreeting.parents('.greeting-option').addClass('active');
							ttsGreeting.collapse('hide');
						}
					});
				} else {
					monster.ui.alert(self.i18n.active().strategy.alertMessages.emptyTtsGreeting);
				}
			});

			uploadGreeting.find('.update-greeting').on('click', function(e) {
				var uploadFile = function(file, greetingId, callback) {
					self.callApi({
						resource: 'media.upload',
						data: {
							accountId: self.accountId,
							mediaId: greetingId,
							data: file
						},
						success: function(data, status) {
							callback && callback();
						}
					});
				};

				if (mediaToUpload) {
					self.callApi({
						resource: 'media.create',
						data: {
							accountId: self.accountId,
							data: {
								streamable: true,
								name: mediaToUpload.name,
								media_source: 'upload',
								description: mediaToUpload.name
							}
						},
						success: function(data, status) {
							greeting = data.data;
							menu.media.greeting = greeting.id;
							self.callApi({
								resource: 'menu.update',
								data: {
									accountId: self.accountId,
									menuId: menu.id,
									data: menu
								},
								success: function(data, status) {
									menu = data.data;
								}
							});

							uploadFile(mediaToUpload.file, greeting.id, function() {
								container.find('.greeting-option').removeClass('active');
								uploadGreeting.parents('.greeting-option').addClass('active');
								uploadGreeting.collapse('hide');
							});
						}
					});
				} else {
					monster.ui.alert(self.i18n.active().strategy.alertMessages.emptyUploadGreeting);
				}
			});

			chooseExisting.find('.update-greeting').on('click', function(ev) {
				ev.preventDefault();

				var greetingId = chooseExisting.find('.choose-input').find(':selected').val();
				menu.media.greeting = greetingId;
				self.callApi({
					resource: 'menu.update',
					data: {
						accountId: self.accountId,
						menuId: menu.id,
						data: menu
					},
					success: function(data, status) {
						menu = data.data;
						container.find('.greeting-option').removeClass('active');
						chooseExisting.parents('.greeting-option').addClass('active');
						chooseExisting.collapse('hide');
					}
				});
			});

			container.find('.cancel-greeting').on('click', function() {
				$(this).parents('.collapse').collapse('hide');
			});

			container.find('.cancel-link').on('click', function(e) {
				e.preventDefault();
				popup.dialog('close');
			});

			container.find('.save-button').on('click', function(e) {
				var menuElements = {},
					invalidData = false;

				$.each(container.find('.menu-line'), function() {
					var $this = $(this),
						selectedEntity = $this.find('.target-select option:selected'),
						number = $this.find('.number-input').val(),
						entityType = selectedEntity.data('type'),
						entityId = selectedEntity.val();

					if (!number || number in menuElements) {
						invalidData = true;
						return false;
					}

					menuElements[number] = {
						children: {},
						module: entityType,
						data: {}
					};

					switch (entityType) {
						case 'ring_group':
							menuElements[number].data.endpoints = [{
								endpoint_type: 'group',
								id: entityId
							}];

							break;
						default:
							menuElements[number].data.id = entityId;

							break;
					}
				});

				if (invalidData) {
					monster.ui.alert(self.i18n.active().strategy.alertMessages.uniqueMenuNumbers);
				} else {
					strategyData.callflows[callflowName].flow.children = menuElements;
					self.strategyUpdateCallflow(strategyData.callflows[callflowName], function(updatedCallflow) {
						strategyData.callflows[callflowName] = updatedCallflow;
					});
					popup.dialog('close');
				}
			});
		},

		strategyGetCallEntitiesDropdownData: function(callEntities, useBasicUser, useBaseGroup) {
			var self = this,
				useBasicUser = (useBasicUser === true) || false,
				useBaseGroup = (useBaseGroup === true) || false,
				entities = $.extend(true, {}, callEntities),
				results = [];

			if (!useBasicUser) {
				entities.user = entities.userCallflows;
			}
			delete entities.userCallflows;
			if (!useBaseGroup) {
				entities.ring_group = entities.userGroups;
			}
			delete entities.userGroups;

			_.each(entities, function(value, key) {
				var group = {
					groupName: self.i18n.active().strategy.callEntities[key],
					groupType: key,
					entities: $.map(value, function(entity) {
						var name = entity.name;

						if (!name) {
							if (entity.hasOwnProperty('first_name')) {
								name = entity.first_name + ' ' + entity.last_name;
							} else if (entity.hasOwnProperty('numbers')) {
								name = entity.numbers.toString();
							}
						}

						return {
							id: entity.id,
							name: name,
							module: entity.module || key
						};
					})
				};

				switch (group.groupType) {
					case 'qubicle':
						group.groupIcon = 'fa fa-headphones';

						break;
					case 'directory':
						group.groupIcon = 'fa fa-book';

						break;
					case 'user':
						group.groupIcon = 'fa fa-user';

						break;
					case 'device':
						group.groupIcon = 'icon-telicon-voip-phone';

						break;
					case 'ring_group':
						group.groupIcon = 'fa fa-users';

						break;
					case 'media':
						group.groupIcon = 'fa fa-music';

						break;
					case 'voicemail':
						group.groupIcon = 'icon-telicon-voicemail';

						break;
					default:
						break;
				}

				group.entities.sort(function(a, b) { return (a.name.toLowerCase() > b.name.toLowerCase()); });
				if (group.groupType === 'directory') {
					results.unshift(group);
				} else if (group.groupType === 'user') {
					if (results[0].groupType === 'directory') {
						results.splice(1, 0, group);
					} else {
						results.unshift(group);
					}
				} else {
					results.push(group);
				}
			});

			return results;
		},
		strategyBuildFaxbox: function(args) {
			var self = this;

			self.strategyGetAccount({
				success: function(account) {
					args.data = {
						name: account.name + self.i18n.active().strategy.faxing.nameExtension,
						caller_name: account.name,
						caller_id: args.data.number,
						fax_header: monster.config.whitelabel.companyName + self.i18n.active().strategy.faxing.headerExtension,
						fax_timezone: account.timezone,
						fax_identity: monster.util.formatPhoneNumber(args.data.number),
						owner_id: account.id,
						notifications: {
							inbound: {
								email: {
									send_to: args.data.email
								}
							}
						}
					};

					self.strategyCreateFaxbox(args);
				}
			});
		},

		strategyGetMainCallflows: function(mainCallback) {
			var self = this;
			monster.waterfall([
				function(waterfallCallback) {
					self.strategyListCallflows({
						filters: {
							'has_value': 'type',
							'key_missing': ['owner_id', 'group_id']
						},
						success: function(data) {
							waterfallCallback(null, data);
						},
						error: function() {
							waterfallCallback(true);
						}
					});
				},
				function(data, waterfallCallback) {
					var parallelRequests = {},
						menuRequests = {};

					_.each(data, function(val, key) {
						if (!_.includes(['main', 'conference', 'faxing'], val.type)) {
							return;
						}

						var name = val.name || val.numbers[0];
						if (val.type === 'conference') {
							name = 'MainConference';
						} else if (val.type === 'faxing') {
							name = 'MainFaxing';
						}

						parallelRequests[name] = function(callback) {
							self.strategyGetCallflow({
								data: {
									id: val.id
								},
								success: function(data) {
									callback(null, data);
								}
							});
						};
					});

					if (!parallelRequests.MainConference) {
						parallelRequests.MainConference = function(callback) {
							self.strategyCreateCallflow({
								data: {
									data: {
										contact_list: {
											exclude: false
										},
										numbers: ['undefinedconf'],
										name: 'MainConference',
										type: 'conference',
										flow: {
											children: {},
											data: {},
											module: 'conference'
										}
									}
								},
								success: function(data) {
									callback(null, data);
								}
							});
						};
					}

					if (!parallelRequests.MainFaxing) {
						parallelRequests.MainFaxing = function(callback) {
							self.strategyCreateCallflow({
								data: {
									data: {
										contact_list: {
											exclude: false
										},
										numbers: ['undefinedfaxing'],
										name: 'MainFaxing',
										type: 'faxing',
										flow: {
											children: {},
											data: {},
											module: 'faxbox'
										}
									}
								},
								success: function(data) {
									callback(null, data);
								}
							});
						};
					}

					_.each(self.subCallflowsLabel, function(val) {
						var menuName = val + 'Menu';

						if (parallelRequests[menuName]) {
							if (parallelRequests[val]) {
								return;
							}

							menuRequests[menuName] = parallelRequests[menuName];
							delete parallelRequests[menuName];
							return;
						}

						menuRequests[menuName] = function(callback) {
							monster.waterfall([
								function(innerCallback) {
									self.strategyCreateMenu({
										data: {
											data: self.strategyGetDefaultMainSubMenu(menuName)
										},
										success: function(menuData) {
											innerCallback(null, menuData);
										},
										error: function(parsedError) {
											innerCallback(true);
										}
									});
								},
								function(menuData, innerCallback) {
									self.strategyCreateCallflow({
										data: {
											data: self.strategyGetDefaultMainSubMenuCallflow(menuData)
										},
										success: function(data) {
											innerCallback(null, data);
										},
										error: function(parsedError) {
											innerCallback(true);
										}
									});
								}
							], function(err, result) {
								!err && callback && callback(null, result);
							});
						};
					});

					monster.parallel(menuRequests, function(err, mainCallflows) {
						_.each(self.subCallflowsLabel, function(val) {
							if (parallelRequests[val]) {
								return;
							}

							parallelRequests[val] = function(callback) {
								self.strategyCreateCallflow({
									data: {
										data: self.strategyGetDefaultMainSubCallflow({
											label: val,
											subMenuCallflowId: mainCallflows[val + 'Menu'].id
										})
									},
									success: function(data) {
										callback(null, data);
									}
								});
							};
						});

						monster.parallel(parallelRequests, function(err, results) {
							if (parallelRequests.MainCallflow) {
								// For users who had undesired callflow with only "0" in it, we migrate it to our new empty main callflow "undefinedMainNumber"
								if (results.MainCallflow.numbers && results.MainCallflow.numbers.length === 1 && results.MainCallflow.numbers[0] === '0') {
									results.MainCallflow.numbers[0] = 'undefinedMainNumber';

									self.strategyUpdateCallflow(results.MainCallflow, function(updatedCallflow) {
										results.MainCallflow = updatedCallflow;
										waterfallCallback(null, _.merge(mainCallflows, results));
									});
									return;
								}

								waterfallCallback(null, _.merge(mainCallflows, results));
								return;
							}

							self.strategyCreateCallflow({
								data: {
									data: {
										contact_list: {
											exclude: false
										},
										numbers: ['undefinedMainNumber'],
										name: 'MainCallflow',
										type: 'main',
										flow: {
											children: {
												'_': {
													children: {},
													data: {
														id: results.MainOpenHours.id
													},
													module: 'callflow'
												}
											},
											data: {},
											module: 'temporal_route'
										}
									}
								},
								success: function(data) {
									results.MainCallflow = data;
									waterfallCallback(null, $.extend(true, mainCallflows, results));
								}
							});
						});
					});
				}
			], function(err, result) {
				if (err) {
					return;
				}
				mainCallback(result);
			});
		},

		strategyHandleFeatureCodes: function() {
			var self = this,
				createFeatureCodeFactory = function createFeatureCodeFactory(featureCode) {
					return function(callback) {
						self.strategyCreateCallflow({
							bypassProgressIndicator: true,
							data: {
								data: _.merge({
									flow: _.merge({
										children: {},
										data: _.get(featureCode, 'metadata', {}),
										module: featureCode.moduleName
									}, _.has(featureCode, 'actionName') && {
										data: {
											action: featureCode.actionName
										}
									}),
									featurecode: _.pick(featureCode, [
										'name',
										'number'
									])
								}, _.has(featureCode, 'pattern') ? {
									patterns: [featureCode.pattern]
								} : {
									numbers: [featureCode.callflowNumber]
								})
							},
							success: _.partial(callback, null),
							error: _.partial(callback, null)
						});
					};
				};

			monster.waterfall([
				function fetchExistingFeatureCodes(callback) {
					self.strategyGetFeatureCodes(_.partial(callback, null));
				},
				function maybeCreateMissingFeatureCodes(existing, callback) {
					monster.parallel(_
						.chain(self.featureCodeConfigs)
						.reject(_.flow([
							_.partial(_.get, _, 'name'),
							_.partial(_.includes, _.map(existing, 'featurecode.name'))
						]))
						.map(createFeatureCodeFactory)
						.value()
					, callback);
				}
			]);
		},

		strategyGetFeatureCodes: function(callback) {
			var self = this;

			self.strategyListCallflows({
				bypassProgressIndicator: true,
				filters: {
					paginate: 'false',
					has_key: 'featurecode'
				},
				success: function(listFeatureCodes) {
					callback && callback(listFeatureCodes);
				}
			});
		},

		strategyGetAllRules: function(globalCallback) {
			var self = this;

			monster.parallel({
				rules: function(localCallback) {
					self.callApi({
						resource: 'temporalRule.list',
						data: {
							accountId: self.accountId,
							filters: { has_key: 'type' }
						},
						success: function(data, status) {
							localCallback && localCallback(null, data.data);
						}
					});
				},
				sets: function(localCallback) {
					self.callApi({
						resource: 'temporalSet.list',
						data: {
							accountId: self.accountId,
							filters: {
								has_key: 'type',
								filter_type: 'main_holidays'
							}
						},
						success: function(data, status) {
							var parallelRequests = {};

							_.each(data.data, function(set) {
								parallelRequests[set.id] = function(callback) {
									self.strategyGetDetailRuleSet(set.id, function(data) {
										callback && callback(null, data);
									});
								};
							});

							monster.parallel(parallelRequests, function(err, results) {
								localCallback && localCallback(null, results);
							});
						}
					});
				}
			}, function(err, results) {
				globalCallback && globalCallback(results);
			});
		},

		strategyGetRule: function(id, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.get',
				data: {
					accountId: self.accountId,
					ruleId: id,
					generateError: false
				},
				success: function(data, status) {
					callback && callback(data.data);
				},
				error: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		strategyGetTemporalRules: function(callback) {
			var self = this;

			self.strategyGetAllRules(function(data) {
				var parallelRequests = {};

				_.each(data.rules, function(val, key) {
					parallelRequests[val.name] = function(callback) {
						self.strategyGetRule(val.id, function(data) {
							callback(null, data);
						});
					};
				});

				// Always check that the necessary time rules exist, or re-create them
				_.each(self.weekdayLabels, function(val) {
					if (!(val in parallelRequests)) {
						parallelRequests[val] = function(callback) {
							self.callApi({
								resource: 'temporalRule.create',
								data: {
									accountId: self.accountId,
									data: {
										cycle: 'weekly',
										interval: 1,
										name: val,
										type: 'main_weekdays',
										time_window_start: 32400, // 9:00AM
										time_window_stop: 61200, // 5:00PM
										wdays: [val.substring(4).toLowerCase()]
									}
								},
								success: function(data, status) {
									callback(null, data.data);
								}
							});
						};
					}
				});

				if (!('MainLunchHours' in parallelRequests)) {
					parallelRequests.MainLunchHours = function(callback) {
						self.callApi({
							resource: 'temporalRule.create',
							data: {
								accountId: self.accountId,
								data: {
									cycle: 'weekly',
									interval: 1,
									name: 'MainLunchHours',
									type: 'main_lunchbreak',
									time_window_start: 43200,
									time_window_stop: 46800,
									wdays: self.weekdays
								}
							},
							success: function(data, status) {
								callback(null, data.data);
							}
						});
					};
				}

				monster.parallel(parallelRequests, function(err, results) {
					var temporalRules = {
						weekdays: {},
						lunchbreak: {},
						holidays: {}
					};

					_.each(results, function(val, key) {
						switch (val.type) {
							case 'main_weekdays':
								temporalRules.weekdays[key] = val;

								break;
							case 'main_lunchbreak':
								temporalRules.lunchbreak = val;

								break;
							case 'main_holidays':
								temporalRules.holidays[key] = val;

								break;
						}
					});

					_.each(data.sets, function(set) {
						if (!_.isEmpty(set)) {
							temporalRules.holidays[set.name] = set;
						}
					});

					callback(temporalRules);
				});
			});
		},

		strategyGetCallEntities: function(callback) {
			var self = this;
			monster.parallel({
				callQueues: function(_callback) {
					self.strategyListCallflows({
						filters: {
							'filter_flow.module': 'qubicle'
						},
						success: function(callQueuesData) {
							_callback(null, callQueuesData);
						}
					});
				},
				users: function(_callback) {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(data, status) {
							_callback(null, data.data);
						}
					});
				},
				media: function(callback) {
					self.strategyListMedia(function(media) {
						callback(null, media);
					});
				},
				userCallflows: function(_callback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								has_key: 'owner_id',
								filter_type: 'mainUserCallflow',
								paginate: 'false'
							}
						},
						success: function(data, status) {
							var mapCallflowsByOwnerId = _.keyBy(data.data, 'owner_id');
							_callback(null, mapCallflowsByOwnerId);
						}
					});
				},
				groups: function(_callback) {
					self.callApi({
						resource: 'group.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(data, status) {
							_callback(null, data.data);
						}
					});
				},
				ringGroups: function(_callback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								'has_key': 'group_id',
								'filter_type': 'baseGroup'
							}
						},
						success: function(data, status) {
							_callback(null, data.data);
						}
					});
				},
				userGroups: function(_callback) {
					self.callApi({
						resource: 'callflow.list',
						data: {
							accountId: self.accountId,
							filters: {
								'has_key': 'group_id',
								'filter_type': 'userGroup'
							}
						},
						success: function(data, status) {
							_callback(null, data.data);
						}
					});
				},
				devices: function(_callback) {
					self.callApi({
						resource: 'device.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(data, status) {
							_callback(null, data.data);
						}
					});
				},
				advancedCallflows: function(_callback) {
					self.strategyListCallflows({
						filters: {
							'filter_ui_is_main_number_cf': true
						},
						success: function(advancedCallflowsData) {
							_callback(null, advancedCallflowsData);
						}
					});
				}
			}, function(err, results) {
				callback({
					advancedCallflows: _.map(results.advancedCallflows, function(callflow) {
						return _.merge({
							module: 'callflow'
						}, callflow);
					}),
					device: _.map(results.devices, function(device) {
						return _.merge({
							module: 'device'
						}, device);
					}),
					qubicle: _.map(results.callQueues, function(callQueue) {
						return _.merge({
							module: 'callflow'
						}, callQueue);
					}),
					play: _.map(results.media, function(media) {
						return _.merge({
							module: 'play'
						}, media);
					}),
					ring_group: _.map(results.groups, function(group) {
						var ringGroup = _.find(results.ringGroups, { group_id: group.id });

						return _.merge({}, group, {
							id: _.get(ringGroup, 'id', group.id),
							module: _.isUndefined(ringGroup) ? 'ring_group' : 'callflow'
						});
					}),
					user: results.users,
					userCallflows: _.map(results.users, function(user) {
						return _.merge({}, user, {
							id: _.get(results.userCallflows, [user.id, 'id'], user.id),
							module: _.has(results.userCallflows, user.id) ? 'callflow' : 'user'
						});
					}),
					userGroups: _.map(results.userGroups, function(userGroup) {
						var group = _.find(results.groups, { id: userGroup.group_id });

						return _.merge({}, userGroup, {
							name: _.get(group, 'name', userGroup.name),
							module: 'callflow'
						});
					})
				});
			});
		},

		strategyGetVoicesmailBoxes: function(callback) {
			var self = this;
			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data, status) {
					data.data.sort(function(a, b) { return (a.name.toLowerCase() > b.name.toLowerCase()); });
					callback(data.data);
				}
			});
		},

		strategyListAccountNumbers: function(callback) {
			var self = this;
			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data, status) {
					callback(data.data.numbers);
				}
			});
		},

		strategyGetNumber: function(phoneNumber, callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.get',
				data: {
					accountId: self.accountId,
					phoneNumber: phoneNumber,
					generateError: false
				},
				success: function(data, status) {
					callback(data.data);
				},
				error: function(data, status) {
					callback({});
				}
			});
		},

		strategyUpdateNumber: function(phoneNumber, data, callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.update',
				data: {
					accountId: self.accountId,
					phoneNumber: phoneNumber,
					data: data
				},
				success: function(data, status) {
					callback();
				}
			});
		},

		strategyRebuildMainCallflowRuleArray: function(strategyData) {
			var self = this,
				mainCallflow = strategyData.callflows.MainCallflow,
				rules = strategyData.temporalRules;

			mainCallflow.flow.data.rules = _
				.chain([
					_.map(rules.holidays, 'id'),
					_.has(rules.lunchbreak, 'id') ? [rules.lunchbreak.id] : [],
					_.map(rules.weekdays, 'id')
				])
				.flatten()
				.filter(_.partial(_.has, mainCallflow.flow.children))
				.value();
		},

		strategyListCallflows: function(args) {
			var self = this;

			self.callApi(_.merge({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: args.filters || {}
				},
				success: function(callflowData) {
					args.hasOwnProperty('success') && args.success(callflowData.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			}, _.has(args, 'bypassProgressIndicator') && {
				bypassProgressIndicator: true
			}));
		},

		strategyCreateCallflow: function(args) {
			var self = this;

			self.callApi(_.merge({
				resource: 'callflow.create',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			}, _.has(args, 'bypassProgressIndicator') && {
				bypassProgressIndicator: true
			}));
		},

		strategyUpdateCallflow: function(callflow, callback) {
			var self = this,
				callflowId = callflow.id;
			delete callflow.metadata;
			delete callflow.id;
			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflowId,
					data: callflow
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		strategyPatchCallflow: function(args) {
			var self = this;

			self.callApi({
				resource: 'callflow.patch',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					args.callback(data.data);
				}
			});
		},

		strategyDeleteCallflow: function(args) {
			var self = this;

			self.callApi(_.merge({
				resource: 'callflow.delete',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			}, _.has(args, 'bypassProgressIndicator') && {
				bypassProgressIndicator: true
			}));
		},

		strategyListDirectories: function(callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'directory.list',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data, status) {
					callbackError && callbackError();
				}
			});
		},

		strategyListMedia: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					callback && callback(data.data);
				}
			});
		},

		_strategyOnCurrentAccountUpdated: function(accountData) {
			var self = this;
			$('#strategy_custom_hours_timezone').text(timezone.formatTimezone(accountData.timezone));
		},

		strategyUpdateOriginalUser: function(userToUpdate, callback) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					userId: userToUpdate.id,
					accountId: monster.apps.auth.originalAccount.id,
					data: userToUpdate
				},
				success: function(savedUser) {
					callback && callback(savedUser.data);
				}
			});
		},

		/**
		 * Updates an account
		 * @param  {Object}   args
		 * @param  {Object}   args.data       Account data
		 * @param  {String}   args.data.id    Account ID
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		strategyUpdateAccount: function(args) {
			var self = this,
				data = args.data;

			self.callApi({
				resource: 'account.update',
				data: {
					accountId: data.id,
					data: data
				},
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Request the current account information
		 * @param  {Object}   args
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Fucntion} [args.error]    Error callback
		 */
		strategyGetAccount: function(args) {
			var self = this;

			self.callApi({
				resource: 'account.get',
				data: {
					accountId: self.accountId
				},
				success: function(data, status) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(data, status) {
					_.has(args, 'error') && args.error();
				}
			});
		},

		strategyGetFaxbox: function(args) {
			var self = this;

			self.callApi({
				resource: 'faxbox.get',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(data, status) {
					args.hasOwnProperty('error') && args.error();
				}
			});
		},

		strategyCreateFaxbox: function(args) {
			var self = this;

			self.callApi({
				resource: 'faxbox.create',
				data: {
					accountId: self.accountId,
					data: args.data
				},
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(data, status) {
					args.hasOwnProperty('error') && args.error();
				}
			});
		},

		strategyUpdateFaxbox: function(args) {
			var self = this;

			self.callApi({
				resource: 'faxbox.update',
				data: $.extend(true, {
					accountId: self.accountId
				}, args.data),
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(data, status) {
					args.hasOwnProperty('error') && args.error();
				}
			});
		},

		strategyDeleteFaxbox: function(args) {
			var self = this;

			self.callApi({
				resource: 'faxbox.delete',
				data: {
					accountId: self.accountId,
					faxboxId: args.data.id
				},
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(data, status) {
					args.hasOwnProperty('error') && args.error();
				}
			});
		},

		strategyGetCallflow: function(args) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: args.data.id
				},
				success: function(data, status) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Gets a menu list from the API
		 * @param  {Object}   args
		 * @param  {Object}   [args.filters]  Filters to be applied to query the menus
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		strategyListMenus: function(args) {
			var self = this;

			self.callApi({
				resource: 'menu.list',
				data: {
					accountId: self.accountId,
					filters: _.get(args, 'filters', {})
				},
				success: function(data) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Request the creation of a menu to the API
		 * @param  {Object}   args
		 * @param  {Object}   args.data
		 * @param  {Object}   args.data.data  Menu object to be created
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		strategyCreateMenu: function(args) {
			var self = this;

			self.callApi({
				resource: 'menu.create',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Requests a menu update in the API
		 * @param  {Object}   args
		 * @param  {Object}   args.data
		 * @param  {String}   args.data.menuId  ID of the menu to be updated
		 * @param  {Object}   args.data.data    Menu object to update
		 * @param  {Function} [args.success]    Success callback
		 * @param  {Function} [args.error]      Error callback
		 */
		strategyUpdateMenu: function(args) {
			var self = this;

			self.callApi({
				resource: 'menu.update',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					args.hasOwnProperty('success') && args.success(data.data);
				},
				error: function(parsedError) {
					args.hasOwnProperty('error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Gets a main sub menu for call handling strategies, with the default structure
		 * @param  {String} menuName  Menu name
		 */
		strategyGetDefaultMainSubMenu: function(menuName) {
			return {
				name: menuName,
				record_pin: monster.util.randomString(4, '1234567890'),
				media: {
					exit_media: true,
					invalid_media: true,
					transfer_media: true
				},
				retries: 3,
				max_extension_length: 4,
				type: 'main'
			};
		},

		/**
		 * Gets a main callflow for a call handling strategy menu, with the default structure
		 * and values
		 * @param  {Object} menuData
		 * @param  {String} menuData.name  Menu name
		 * @param  {String} menuData.id    Menu ID
		 * @returns  {Object}  Sub menu callflow
		 */
		strategyGetDefaultMainSubMenuCallflow: function(menuData) {
			return {
				contact_list: {
					exclude: false
				},
				numbers: [ menuData.name ],
				type: 'main',
				flow: {
					children: {},
					data: {
						id: menuData.id
					},
					module: 'menu'
				}
			};
		},

		/**
		 * Gets a main callflow for call handling strategies, with the default structure and
		 * values
		 * @param  {Object} args
		 * @param  {String} args.label              Callflow label, to be set as number
		 * @param  {String} args.subMenuCallflowId  ID of the sub menu callflow
		 * @returns  {Object}  Callflow for call handling strategy
		 */
		strategyGetDefaultMainSubCallflow: function(args) {
			return {
				contact_list: {
					exclude: false
				},
				numbers: [ args.label ],
				type: 'main',
				flow: {
					children: {},
					data: {
						id: args.subMenuCallflowId
					},
					module: 'callflow'
				}
			};
		},

		/**
		 * Get callflows and menus for call handling strategies
		 * @param  {Function} callback  Callback function for monster async tasks
		 */
		strategyGetSubCallStrategiesData: function(callback) {
			var self = this;

			monster.parallel({
				callflows: function(parallelCallback) {
					self.strategyListCallflows({
						filters: {
							paginate: false,
							has_value: 'type',
							filter_type: 'main',
							key_missing: [
								'owner_id',
								'group_id'
							],
							'filter_ui_metadata.origin': [
								'voip'
							]
						},
						success: function(data) {
							// Convert callflows array to map object, then send to next step
							parallelCallback(null,
								_.reduce(data, function(obj, callflow) {
									var label = callflow.name || callflow.numbers[0];
									obj[label] = callflow;
									return obj;
								}, {}));
						},
						error: function(parsedError) {
							parallelCallback(parsedError);
						}
					});
				},
				menus: function(parallelCallback) {
					self.strategyListMenus({
						filters: {
							paginate: false,
							has_value: 'type',
							filter_type: 'main'
						},
						success: function(data) {
							parallelCallback(null,
								_.reduce(data, function(obj, menu) {
									obj[menu.name] = menu;
									return obj;
								}, {}));
						},
						error: function(parsedError) {
							parallelCallback(parsedError);
						}
					});
				}
			}, callback);
		},

		/**
		 * Helper function to create or update a main menu
		 * @param  {Object}   args
		 * @param  {Object}   args.mainMenus  Map object that contains the main menus
		 * @param  {String}   args.menuLabel  Label of the menu to be saved
		 * @param  {Function} args.callback   Callback function for monster async tasks
		 */
		strategySaveMainSubMenu: function(args) {
			var self = this,
				mainMenus = args.mainMenus,
				menuLabel = args.menuLabel,
				callback = args.callback;

			var menuArgs = {
				data: {
					data: self.strategyGetDefaultMainSubMenu(menuLabel)
				},
				success: function(menu) {
					callback(null, menu);
				},
				error: function(parsedError) {
					callback(parsedError);
				}
			};

			if (!mainMenus.hasOwnProperty(menuLabel)) {
				self.strategyCreateMenu(menuArgs);
				return;
			}

			var menuToUpdate = mainMenus[menuLabel];
			menuArgs.data.menuId = menuArgs.data.data.id = menuToUpdate.id;
			self.strategyUpdateMenu(menuArgs);
		},

		/**
		 * Helper function to create or update a main sub callflow
		 * @param  {Object}   args
		 * @param  {Object}   args.mainCallflows     Map object that contains the main callflows
		 * @param  {String}   args.callflowLabel     Label of the callflow to be saved
		 * @param  {String}   [args.savedCallflows]  Map object to which append the saved callflow
		 * @param  {Object}   args.callflow          Default callflow to be saved
		 * @param  {Function} args.callback          Callback function for monster async tasks
		 */
		strategySaveMainSubCallflow: function(args) {
			var self = this,
				mainCallflows = args.mainCallflows,
				callflowLabel = args.callflowLabel,
				savedCallflows = _.get(args, 'savedCallflows', {}),
				callflow = args.callflow,
				callback = args.callback;

			if (!mainCallflows.hasOwnProperty(callflowLabel)) {
				self.strategyCreateCallflow({
					data: {
						data: callflow
					},
					success: function(savedCallflow) {
						savedCallflows[callflowLabel] = savedCallflow;
						callback(null, savedCallflows);
					},
					error: function(parsedError) {
						callback(parsedError);
					}
				});
				return;
			}

			callflow.id = mainCallflows[callflowLabel].id;
			self.strategyUpdateCallflow(callflow, function(savedCallflow) {
				savedCallflows[callflowLabel] = savedCallflow;
				callback(null, savedCallflows);
			});
		},

		/**
		 * Reset call handling strategies
		 * @param  {Object}   args
		 * @param  {Object}   args.callflows  Sub callflows for strategies
		 * @param  {Object}   args.menus      Sub menus for strategies
		 * @param  {Function} args.callback   Callback function for monster async tasks
		 */
		strategyResetSubCallStrategies: function(args) {
			var self = this;

			monster.parallel(
				_.map(self.subCallflowsLabel, function(label) {
					var menuLabel = label + 'Menu';

					// Pack the waterfall process, and call for the outer parallel process
					return function(parallelCallback) {
						monster.waterfall([
							function(waterfallCallback) {
								// Update or create sub menu
								self.strategySaveMainSubMenu({
									mainMenus: args.menus,
									menuLabel: menuLabel,
									callback: waterfallCallback
								});
							},
							function(savedMenu, waterfallCallback) {
								// Update or create sub menu callflow
								self.strategySaveMainSubCallflow({
									mainCallflows: args.callflows,
									callflowLabel: menuLabel,
									callflow: self.strategyGetDefaultMainSubMenuCallflow(savedMenu),
									callback: waterfallCallback
								});
							},
							function(savedCallflows, waterfallCallback) {
								// Update or create sub callflow
								self.strategySaveMainSubCallflow({
									mainCallflows: args.callflows,
									callflowLabel: label,
									savedCallflows: savedCallflows,
									callflow: self.strategyGetDefaultMainSubCallflow({
										label: label,
										subMenuCallflowId: savedCallflows[menuLabel].id
									}),
									callback: waterfallCallback
								});
							}
						], parallelCallback);
					};
				}),
				function(err, results) {
					args.callback(err, _.reduce(results, _.assign));
				});
		},

		/**
		 * Extracts the phone numbers from the main callflow
		 * @param    {Object} args
		 * @param    {Object} args.mainCallflow  Main callflow
		 * @returns  {String[]}                  Phone numbers
		 */
		strategyExtractMainNumbers: function(args) {
			var self = this,
				mainCallflow = args.mainCallflow;

			return _.filter(mainCallflow.numbers, function(val) {
				return val !== '0' && val !== 'undefinedMainNumber';
			});
		}
	};

	return app;
});
