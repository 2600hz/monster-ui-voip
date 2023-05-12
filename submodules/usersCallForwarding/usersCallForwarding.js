define(function(require) {
	var _ = require('lodash');
	var monster = require('monster');

	return {
		usersCallForwardingRender: function(user) {
			var self = this,
				getData = _.bind(self.usersCallForwardingGetData, self),
				formatData = _.bind(self.usersCallForwardingFormatData, self),
				bindEvents = _.bind(self.usersCallForwardingBindingEvents, self),
				initTemplate = function(data) {
					var isCallForwardVmEnabled = _.get(user, 'call_forward_vm.unconditional.enabled', false)
												|| _.get(user, 'call_forward_vm.busy.enabled', false)
												|| _.get(user, 'call_forward_vm.no_answer.enabled', false)
												|| _.get(user, 'call_forward_vm.selective.enabled', false),
						isCallForwardEnabled = _.get(user, 'call_forward.unconditional.enabled', false)
												|| _.get(user, 'call_forward.busy.enabled', false)
												|| _.get(user, 'call_forward.no_answer.enabled', false)
												|| _.get(user, 'call_forward.selective.enabled', false),
						layoutTemplate = $(self.getTemplate({
							name: 'layout',
							data: {
								data: formatData(data),
								enabled: isCallForwardEnabled || isCallForwardVmEnabled,
								isUnconditionalEnabled: _.get(user, 'call_forward.unconditional.enabled', false) || _.get(user, 'call_forward_vm.unconditional.enabled', false),
								isBusyEnabled: _.get(user, 'call_forward.busy.enabled', false) || _.get(user, 'call_forward_vm.busy.enabled', false),
								isNoAnswerEnabled: _.get(user, 'call_forward.no_answer.enabled', false) || _.get(user, 'call_forward_vm.no_answer.enabled', false),
								isSelectiveEnabled: _.get(user, 'call_forward.selective.enabled', false) || _.get(user, 'call_forward_vm.selective.enabled', false)
							},
							submodule: 'usersCallForwarding'
						}));

					layoutTemplate.find('.feature-popup-title').each(function() {
						var strategy = $(this).data('template'),
							hasVmBox = _.has(user, 'call_forward_vm'),
							hasPhoneNumber = _.has(user, 'call_forward'),
							isKeepCallerIdEnabled = _.get(user, ['call_forward', strategy, 'keep_caller_id'], false),
							isDirectCallsOnlyEnabled = _.get(user, ['call_forward', strategy, 'direct_calls_only'], false) || _.get(user, ['call_forward_vm', strategy, 'direct_calls_only'], false),
							isRequireKeypressEnabled = _.get(user, ['call_forward', strategy, 'require_keypress'], false),
							isIgnoreEarlyMediaEnabled = _.get(user, ['call_forward', strategy, 'ignore_early_media'], false);

						if (strategy !== 'off' || strategy !== 'selective') {
							var simpleStrategyTemplate = $(self.getTemplate({
								name: 'simpleStrategy',
								data: {
									strategy: strategy,
									enabled: isCallForwardVmEnabled || isCallForwardEnabled,
									number: _.get(user, ['call_forward', strategy, 'number'], ''),
									keep_caller_id: isKeepCallerIdEnabled,
									direct_calls_only: isDirectCallsOnlyEnabled,
									require_keypress: isRequireKeypressEnabled,
									ignore_early_media: isIgnoreEarlyMediaEnabled,
									type: hasVmBox ? 'voicemail' : hasPhoneNumber && isCallForwardEnabled ? 'phoneNumber' : 'voicemail',
									voicemails: data.voicemails,
									selectedVoicemailId: _.get(user, 'ui_help.voicemail_id', data.voicemails[0]),
									user: user
								},
								submodule: 'usersCallForwarding'
							}));
							$(this).find('.simple-strategy').append(simpleStrategyTemplate);
						}
						if (strategy === 'selective') {
							var complexStrategyTemplate = $(self.getTemplate({
									name: 'complexStrategy',
									data: {
										strategy: strategy,
										enabled: isCallForwardVmEnabled || isCallForwardEnabled,
										number: _.get(user, ['call_forward', strategy, 'number'], ''),
										keep_caller_id: isKeepCallerIdEnabled,
										direct_calls_only: isDirectCallsOnlyEnabled,
										require_keypress: isRequireKeypressEnabled,
										ignore_early_media: isIgnoreEarlyMediaEnabled,
										type: hasVmBox ? 'voicemail' : hasPhoneNumber && isCallForwardEnabled ? 'phoneNumber' : 'voicemail',
										voicemails: data.voicemails,
										selectedVoicemailId: _.get(user, 'ui_help.voicemail_id', data.voicemails[0]),
										rules: _.get(data, 'match_list_cf.rules'),
										user: user
									},
									submodule: 'usersCallForwarding'
								})),
								matchListRules = data.match_list_cf.rules;

							$(this).find('.complex-strategy').append(complexStrategyTemplate);

							_.forEach(matchListRules, function(value, index) {
								self.renderRulesListingTemplate(self, complexStrategyTemplate, index);
							});
						}
					});

					return layoutTemplate;
				};

			monster.waterfall([
				getData
			], function(err, voicemails) {
				var data = {
						voicemails: voicemails,
						user: user
					},
					callback = data.user.callback;
				monster.waterfall([
					function(waterfallCallback) {
						if (_.has(data, 'user.ui_help.match_list_id')) {
							self.getUserMatchList(data.user.ui_help.match_list_id, function(matchList) {
								waterfallCallback(null, matchList);
							});
						} else {
							self.createUserDefaultMatchList(function(createdMatchlist) {
								waterfallCallback(null, createdMatchlist);
							});
						}
					},
					function(matchList, waterfallCallback) {
						var newData = _.merge(data, {
								match_list_cf: matchList
							}),
							$template = initTemplate(newData);

						bindEvents($template, newData);

						monster.ui.dialog($template, {
							title: user.extra.mapFeatures.call_forwarding.title,
							position: ['center', 20]
						});
					}
				], callback);
			});
		},

		usersCallForwardingGetData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId
				},
				success: _.flow(
					_.partial(_.get, _, 'data'),
					_.partial(callback, null)
				),
				error: _.partial(callback, _, [])
			});
		},

		usersCallForwardingBindingEvents: function($template, data) {
			var self = this,
				getPopup = function($node) {
					return $node.parents('.ui-dialog-content');
				};

			$template.find('.save').on('click', function() {
				var $button = $(this),
					updateData = self.usersCallForwardingGetFormData(data);

				self.usersCallForwardingSaveData({
					data: updateData,
					userId: data.user.id
				}, function(err) {
					if (err) {
						return monster.ui.toast({
							type: 'warning',
							message: self.i18n.active().users.callForwarding.toast.error.save
						});
					}
					getPopup($button).dialog('close');

					self.usersRender({
						userId: data.user.id,
						openedTab: 'features'
					});
				});
			});

			$template.find('.cancel-link').on('click', function() {
				getPopup($(this)).dialog('close');
			});

			$template.find('.switch-state').on('change', function() {
				var self = this,
					strategy = self.parentElement.parentElement.parentElement.attributes['data-template'] ? self.parentElement.parentElement.parentElement.attributes['data-template'].value : self.parentElement.parentElement.parentElement.parentElement.attributes['data-template'].value,
					dataStrategyString = 'data-strategy="' + strategy + '"',
					simpleStrategyContainers = $template.find('.simple-strategy'),
					complexStrategyContainer = $template.find('.complex-strategy');

				simpleStrategyContainers.push(complexStrategyContainer[0]);

				_.forEach(simpleStrategyContainers, function(div) {
					if (div.outerHTML.includes(dataStrategyString)) {
						$template.find(div).removeClass('disabled');
					} else {
						$template.find(div).addClass('disabled');
					}
				});
			});

			$template.on('change', '.radio-state', function() {
				var self = this,
					strategy = self.name.split('.')[0],
					options = $template.find('.option[strategy=' + strategy + ']');

				if (self.checked && self.defaultValue === 'phoneNumber') {
					$(this).closest('.phone-number-wrapper').siblings().find('.simple-control-group.voicemail').addClass('disabled').find('input').prop('checked', false);
					$(this).closest('.phone-number-wrapper').find('.simple-control-group.phone-number').removeClass('disabled').find('input').prop('checked', true);

					_.each(options, function(div) {
						$template.find(div).removeClass('disabled').find('input');
					});

					if (strategy === 'selective') {
						$(this).closest('.phone-number-wrapper').find('.selective-control-group.phone-number').removeClass('disabled');
						$(this).closest('.phone-number-wrapper').siblings().find('.selective-control-group.voicemail').addClass('disabled');
					}
				}

				if (self.checked && self.defaultValue === 'voicemail') {
					$(this).closest('.voicemail-wrapper').find('.simple-control-group.voicemail').removeClass('disabled').find('input').prop('checked', true);
					$(this).closest('.voicemail-wrapper').siblings().find('.simple-control-group.phone-number').addClass('disabled').find('input').prop('checked', false);
					_.each(options, function(div) {
						if (div.children[0].innerText !== 'Forward direct calls only') {
							$template.find(div).addClass('disabled').find('input');
						}
					});

					if (strategy === 'selective') {
						$(this).closest('.voicemail-wrapper').find('.selective-control-group.voicemail').removeClass('disabled');
						$(this).closest('.voicemail-wrapper').siblings().find('.selective-control-group.phone-number').addClass('disabled');
					}
				}

				if (self.checked && self.defaultValue === 'custom') {
					$(this).closest('.monster-radio').siblings('.office-hours-wrapper').removeClass('disabled');
				} else if (self.checked && self.defaultValue === 'always') {
					$(this).closest('.monster-radio').siblings('.office-hours-wrapper').addClass('disabled');
				}

				if (self.checked) {
					self.defaultValue === 'allNumbers' && $(this).parent('.monster-radio').siblings().find('.selective-control-group.specific').addClass('disabled').closest('input').prop('checked', false);
					self.defaultValue === 'specific' && $(this).parent('.monster-radio').siblings('.selective-control-group.specific').removeClass('disabled').closest('input').prop('checked', true);
				}
			});

			$template.find('.checkbox').each(function() {
				if ($(this).is(':checked')) {
					$(this).closest('.option').addClass('option-checked');
				}

				$(this).on('change', function() {
					if ($(this).is(':checked')) {
						$(this).closest('.option').addClass('option-checked');
					} else {
						$(this).closest('.option').removeClass('option-checked');
					}
				});
			});

			$template.on('click', '.add-phone-number', function() {
				var count = $(this).closest('.selective-control-group.specific').find('.controls').length,
					containerToAppend = $(this).closest('.selective-control-group.specific').find('.specific-phone-number-wrapper'),
					numberContainer = $(this).closest('.selective-control-group.specific').find('.specific-phone-number-wrapper')[0].children[1].outerHTML;
				if (count < 10) {
					$(containerToAppend[0]).append(numberContainer);
				}
			});

			$template.on('click', '.remove-number-button', function() {
				var count = $(this).closest('.specific-phone-number-wrapper').find('.controls.specific-controls').length;
				if (count > 1) {
					$(this).closest('.controls.specific-controls').remove();
				}
			});

			$template.on('click', '.add-rule', function() {
				var user = data.user,
					hasVmBox = _.has(user, 'call_forward_vm'),
					hasPhoneNumber = _.has(user, 'call_forward'),
					count = $template.find('.complex-strategy-header').length;

				if (count < 3) {
					var ruleTemplate = $(self.getTemplate({
						name: 'rule',
						data: {
							number: _.get(user, 'call_forward.selective.number', ''),
							type: hasVmBox ? 'voicemail' : hasPhoneNumber ? 'phoneNumber' : 'voicemail',
							voicemails: data.voicemails,
							selectedVoicemailId: _.get(user, 'ui_help.voicemail_id', data.voicemails[0]),
							index: count
						},
						submodule: 'usersCallForwarding'
					}));

					$template.find('.test-append').append(ruleTemplate);
					self.renderRulesListingTemplate(self, ruleTemplate, count);
				}
			});

			$template.on('click', '.remove-rule-button', function() {
				var count = $template.find('.complex-strategy-header').length;

				if (count > 1) {
					$(this).closest('.complex-strategy-header').remove();
				}
			});
		},

		usersCallForwardingGetFormData: function(data) {
			var self = this,
				user = data.user,
				formData = monster.ui.getFormData('call_forward_form'),
				callForwardStrategy = formData.call_forwarding_strategy,
				callForwardData = formData[callForwardStrategy],
				isVmboxEnabled = callForwardStrategy !== 'off' && callForwardData.type === 'voicemail',
				strategies = ['unconditional', 'busy', 'no_answer', 'selective'],
				hasMatchList = _.has(user, 'call_forward.selective.rules'),
				payload = callForwardStrategy === 'off' ? {
					call_forward: {
						enabled: false
					},
					call_forward_vm: null
				} : callForwardData.type === 'phoneNumber' ? {
					call_forward: {
						enabled: true,
						[callForwardStrategy]: {
							enabled: true,
							keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
							direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
							require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
							ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
							substitute: false,
							number: _.get(callForwardData, 'phoneNumber', '')
						}
					},
					call_forward_vm: null
				} : {
					call_forward_vm: {
						[callForwardStrategy]: {
							enabled: callForwardStrategy !== 'off' && callForwardData.type === 'voicemail',
							voicemail: _.get(callForwardData, 'voicemail.value', ''),
							direct_calls_only: true
						}
					},
					call_forward: null
				};

			if (callForwardStrategy === 'selective' && callForwardData.type === 'phoneNumber') {
				_.merge(payload, {
					call_forward: {
						selective: {
							enabled: true,
							number: callForwardData.phoneNumber,
							direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
							ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
							keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
							require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
							substitute: null,
							rules: hasMatchList ? _.get(user, 'call_forward.selective.rules') : []
						}
					}
				});
			}

			_.each(strategies, function(strategy) {
				if (strategy !== callForwardStrategy) {
					_.assign(payload.call_forward, {
						[strategy]: null
					});
					_.assign(payload.call_forward_vm, {
						[strategy]: null
					});
				}
			});

			if (callForwardData && callForwardData.type === 'voicemail') {
				_.merge(payload, {
					ui_help: {
						voicemail_id: _.get(callForwardData, 'voicemail.value')
					}
				});
			}

			_.merge(payload, {
				ui_help: {
					match_list_id: _.get(data, 'match_list_cf.id')
				}
			});

			// formattedCallForwardData = self.usersCallForwardingFormatData(data);
			if (callForwardStrategy !== 'off') {
				self.userUpdateCallflow(user, callForwardData.type);
			}

			if (callForwardStrategy === 'selective' && callForwardData.type === 'phoneNumber') {
				if (payload.call_forward.selective.rules.length <= 0) {

				}
			}

			return payload;
		},

		usersCallForwardingFormatData: function(data) {
			var self = this,
				user = data.user,
				isCallForwardConfigured = _.has(user, 'call_forward.enabled'),
				isCallForwardEnabled = _.get(user, 'call_forward.enabled', false),
				isFailoverEnabled = _.get(user, 'call_failover.enabled', false);

			// cfmode is off if call_forward.enabled = false && call_failover.enabled = false
			// cfmode is failover if call_failover.enabled = true
			// cfmode is on if call_failover.enabled = false && call_forward.enabled = true
			var callForwardMode = 'off';
			if (isFailoverEnabled) {
				callForwardMode = 'failover';
			} else if (isCallForwardEnabled) {
				callForwardMode = 'on';
			}

			return _.merge({}, user, _.merge({
				extra: {
					callForwardMode: callForwardMode
				}
			}, isCallForwardConfigured && {
				call_forward: _.merge({}, _.has(user, 'call_forward.number') && {
					number: monster.util.unformatPhoneNumber(user.call_forward.number)
				})
			}
			));
		},

		usersCallForwardingSaveData: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'user.patch',
				data: {
					accountId: self.accountId,
					userId: data.userId,
					data: data.data
				},
				success: _.partial(callback, null),
				error: _.partial(callback, _)
			});
		},

		getCallflowList: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId
					}
				},
				success: function(callflowData) {
					callback && callback(callflowData.data);
				}
			});
		},

		skipToVoicemail: function(callflowId, enabled, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.patch',
				data: {
					accountId: self.accountId,
					callflowId: callflowId,
					data: {
						flow: {
							data: {
								skip_module: enabled
							}
						}
					}
				},
				success: function(callflowData) {
					callback && callback(callflowData.data);
				}
			});
		},

		getCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(callflowData) {
					callback && callback(callflowData.data);
				}
			});
		},

		userUpdateCallflow: function(data, selectedType) {
			var self = this,
				userId = data.id,
				callback = data.callback;

			monster.waterfall([
				function(waterfallCallback) {
					self.getCallflowList(userId, function(callflowList) {
						waterfallCallback(null, callflowList[0].id);
					});
				},
				function(callflowId, waterfallCallback) {
					self.getCallflow(callflowId, function(callflow) {
						waterfallCallback(null, callflow);
					});
				},
				function(callflow, waterfallCallback) {
					var id = callflow.id,
						flow = callflow.flow.data.skip_module,
						enabled = selectedType === 'voicemail';

					if (enabled !== flow) {
						// Skip to voicemail if voicemail is selected
						self.skipToVoicemail(id, enabled);
					} else {
						// Module does not exist in callflow, but should, so err
						waterfallCallback(true);
					}
				}
			], callback);
		},

		listUserMatchLists: function(callback) {
			var self = this;

			self.callApi({
				resource: 'matchList.list',
				data: {
					accountId: self.accountId
				},
				success: function(matchListData) {
					callback && callback(matchListData.data);
				}
			});
		},

		getUserMatchList: function(matchListId, callback) {
			var self = this;

			self.callApi({
				resource: 'matchList.get',
				data: {
					accountId: self.accountId,
					matchListId: matchListId
				},
				success: function(matchListData) {
					callback && callback(matchListData.data);
				}
			});
		},

		createUserDefaultMatchList: function(callback) {
			var self = this,
				matchListName = 'Default Match List',
				ruleName = 'Default Rule',
				type = 'regex';

			self.callApi({
				resource: 'matchList.create',
				data: {
					accountId: self.accountId,
					data: {
						name: matchListName,
						rules: [
							{
								name: ruleName,
								type: type
							}
						]
					}
				},
				success: function(matchListData) {
					callback && callback(matchListData.data);
				}
			});
		},

		patchUserMatchList: function(temporalRuleId, callback) {
			var self = this;

			self.callApi({
				resource: 'matchList.patch',
				data: {
					accountId: self.accountId,
					data: {
						name: 'Match List for Selective',
						rules: [
							{
								name: 'Rule Name',
								regex: '^313$',
								target: '+13132961231',
								temporal_route_id: temporalRuleId,
								type: 'regex'
							}
						]
					}
				},
				success: function(matchListData) {
					callback && callback(matchListData.data);
				}
			});
		},

		deleteUserMatchList: function(matchListId, callback) {
			var self = this;

			self.callApi({
				resource: 'matchList.delete',
				data: {
					accountId: self.accountId,
					matchListId: matchListId
				},
				success: function(matchListData) {
					callback && callback(matchListData.data);
				}
			});
		},

		createUserTemporalRule: function(accountId, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRules.create',
				data: {
					accountId: accountId,
					data: data
				},
				success: function(temporalRuleData) {
					callback && callback(temporalRuleData.data);
				}
			});
		},

		usersMatchListGetData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId
				},
				success: _.flow(
					_.partial(_.get, _, 'data'),
					_.partial(callback, null)
				),
				error: _.partial(callback, _, [])
			});
		},

		renderRulesListingTemplate: function(data, template, ruleIndex) {
			var self = data,
				meta = self.appFlags.strategyHours.intervals,
				timepickerStep = meta.timepicker.step,
				intervalLowerBound = meta.min,
				intervalUpperBound = meta.max,
				intervals = [
					{
						weekday: 'monday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'tuesday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'wednesday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'thursday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'friday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'saturday',
						start: 0,
						end: 84600,
						active: true
					},
					{
						weekday: 'sunday',
						start: 0,
						end: 84600,
						active: true
					}
				],
				listingTemplate = $(self.getTemplate({
					name: 'listing',
					data: {
						strategy: 'selective',
						intervals: intervals,
						ruleIndex: ruleIndex
					},
					submodule: 'usersCallForwarding'
				}));

			_.forEach(intervals, function(interval, index) {
				var $startPicker = listingTemplate.find('input[name="selective.rule[' + ruleIndex + '].intervals[' + index + '].start"]'),
					$endPicker = listingTemplate.find('input[name="selective.rule[' + ruleIndex + '].intervals[' + index + '].end"]'),
					endTime = interval.end,
					endRemainder = endTime % timepickerStep,
					startPickerMaxTime = endTime - endRemainder - (endRemainder > 0 ? 0 : timepickerStep),
					startTime = interval.start,
					startRemainder = startTime % timepickerStep,
					endPickerMinTime = startTime - startRemainder + timepickerStep;

				monster.ui.timepicker($startPicker, {
					listWidth: 1,
					minTime: intervalLowerBound,
					maxTime: startPickerMaxTime
				});
				$startPicker.timepicker('setTime', startTime);

				monster.ui.timepicker($endPicker, {
					listWidth: 1,
					minTime: endPickerMinTime,
					maxTime: intervalUpperBound - timepickerStep
				});
				$endPicker.timepicker('setTime', endTime);
			});

			$(template).find('.office-hours-wrapper').append(listingTemplate);
		}
	};
});
