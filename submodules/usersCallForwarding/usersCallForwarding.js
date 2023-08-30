define(function(require) {
	var _ = require('lodash');
	var monster = require('monster');

	return {
		usersCallForwardingRender: function(user) {
			var self = this,
				getData = _.bind(self.usersCallForwardingGetData, self),
				bindEvents = _.bind(self.usersCallForwardingBindingEvents, self),
				initTemplate = function(data) {
					var isCallForwardVmEnabled = _.get(user, 'smartpbx.call_forwarding.enabled', false),
						isCallForwardEnabled = _.has(user, 'call_forward'),
						isUnconditionalVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.unconditional') && isCallForwardVmEnabled,
						isBusyVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.busy') && isCallForwardVmEnabled,
						isNoAnswerVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.no_answer') && isCallForwardVmEnabled,
						isSelectiveVmEnabled = !isCallForwardEnabled && _.has(user, 'smartpbx.call_forwarding.selective') && isCallForwardVmEnabled,
						layoutTemplate = $(self.getTemplate({
							name: 'layout',
							data: {
								data: data,
								enabled: isCallForwardEnabled || isCallForwardVmEnabled,
								isUnconditionalEnabled: _.get(user, 'call_forward.unconditional.enabled', false) || isUnconditionalVmEnabled,
								isBusyEnabled: _.get(user, 'call_forward.busy.enabled', false) || isBusyVmEnabled,
								isNoAnswerEnabled: _.get(user, 'call_forward.no_answer.enabled', false) || isNoAnswerVmEnabled,
								isSelectiveEnabled: _.get(user, 'call_forward.selective.enabled', false) || isSelectiveVmEnabled
							},
							submodule: 'usersCallForwarding'
						}));

					layoutTemplate.find('.feature-popup-title').each(function() {
						var strategy = $(this).data('template'),
							hasVmBox = _.get(user, 'smartpbx.call_forwarding.enabled') && !_.has(user, 'call_forward'),
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
									type: hasVmBox ? 'voicemail' : isCallForwardEnabled ? 'phoneNumber' : 'voicemail',
									voicemails: data.voicemails,
									selectedVoicemailId: _.get(user, ['smartpbx', 'call_forwarding', strategy, 'voicemail'], data.voicemails[0]),
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
										type: 'voicemail',
										voicemails: data.voicemails,
										selectedVoicemailId: _.get(user, ['smartpbx', 'call_forwarding', strategy, 'voicemail'], data.voicemails[0]),
										rules: _.get(data, 'match_list_cf'),
										user: user
									},
									submodule: 'usersCallForwarding'
								})),
								matchListRules = data.match_list_cf;

							$(this).find('.complex-strategy').append(complexStrategyTemplate);

							_.each(matchListRules, function(matchList, index) {
								var isMatchListSpecific = _.get(matchList, 'regex', '^+1d{10}$') !== '^+1d{10}$',
									ruleTemplate = $(self.getTemplate({
										name: 'rule',
										data: {
											from: isMatchListSpecific ? 'specific' : 'allNumbers',
											type: matchList.name === 'Default Rule' || matchList.type === 'voicemail' ? 'voicemail' : 'phoneNumber',
											duration: _.get(matchList, 'type') === 'regex' || _.get(matchList, 'duration') === 'always' ? 'always' : 'custom',
											voicemails: data.voicemails,
											selectedVoicemailId: _.get(user, ['smartpbx', 'call_forwarding', strategy, 'voicemail'], data.voicemails[0]),
											number: _.get(user, ['call_forward', strategy, 'number'], ''),
											index: index
										},
										submodule: 'usersCallForwarding'
									}));

								$(complexStrategyTemplate).find('.append-phone-number').append(ruleTemplate);
								matchList.name !== 'Default Rule' && $(complexStrategyTemplate).find('.options-container').parent().removeClass('disabled');

								var numbers = self.regexToArray(matchList.regex);

								_.each(numbers, function(number, index) {
									var containerToAppend = $(ruleTemplate).find('.specific-phone-number-wrapper'),
										numberContainer = $(ruleTemplate).find('.specific-phone-number-wrapper').children().last()[0].outerHTML;

									$(ruleTemplate).find('.specific-phone-number-wrapper').children().last().find('input').prop('value', number);
									$(containerToAppend[0]).append(numberContainer);
								});

								if (!_.isEmpty(numbers)) {
									$(ruleTemplate).find('.specific-phone-number-wrapper').children().last().detach();
								}
							});

							_.forEach(matchListRules, function(value, index) {
								var intervals = _.get(value, 'temporal_route_id[0].intervals', []);
								self.renderRulesListingTemplate(self, complexStrategyTemplate, index, intervals);
							});
						}
					});

					return layoutTemplate;
				};

			monster.waterfall([
				getData
			], function(err, voicemails) {
				var userVoicemails = _.filter(voicemails, function(vmbox) { return vmbox.owner_id === user.id }),
					data = {
						voicemails: userVoicemails,
						user: user
					},
					callback = data.user.callback;
				monster.waterfall([
					function(waterfallCallback) {
						self.getMatchList(function(matchList) {
							var userMatchList = _.find(matchList, function(list) {
								return list.owner_id === data.user.id;
							});

							if (!userMatchList) {
								self.createUserDefaultMatchList(data.user.id, function(createdMatchlist) {
									waterfallCallback(null, createdMatchlist);
								});
							} else {
								self.getUserMatchList(userMatchList.id, function(userMatchList) {
									waterfallCallback(null, userMatchList);
								});
							}
						});
					},
					function(matchList, waterfallCallback) {
						var newData = _.set(data, 'match_list_cf', matchList),
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
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
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
					updateData = self.usersCallForwardingGetFormData(data),
					cleanedData = self.usersCleanUserData(updateData);

				self.usersCallForwardingSaveData(cleanedData, function(err) {
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
					if (div.outerHTML.includes(dataStrategyString) && !_.has(data.user, ['call_forward', strategy])) {
						$template.find(div).removeClass('disabled');
						$(div).find('.radio-state[value="voicemail"]').prop('checked', true);
						$(div).find('.options').addClass('disabled');
						$(div).find('.simple-control-group.phone-number').addClass('disabled');
						$(div).find('.simple-control-group.voicemail').removeClass('disabled');
					} else if (div.outerHTML.includes(dataStrategyString) && _.has(data.user, ['call_forward', strategy])) {
						$template.find(div).removeClass('disabled');
					} else {
						$template.find(div).addClass('disabled');
					}
				});
			});

			$template.on('change', '.radio-state', function() {
				var self = this,
					strategy = self.name.split('.')[0];

				if (self.checked && self.defaultValue === 'phoneNumber') {
					$(this).closest('.phone-number-wrapper').siblings().find('.simple-control-group.voicemail').addClass('disabled').find('input').prop('checked', false);
					$(this).closest('.phone-number-wrapper').find('.simple-control-group.phone-number').removeClass('disabled').find('input').prop('checked', true);

					$(this).closest('.phone-number-wrapper').siblings('.options').removeClass('disabled');

					if (strategy === 'selective') {
						$(this).closest('.phone-number-wrapper').find('.selective-control-group.phone-number').removeClass('disabled');
						$(this).closest('.phone-number-wrapper').siblings().find('.selective-control-group.voicemail').addClass('disabled');
						$(this).closest('.test-append').siblings('.options').removeClass('disabled');
					}
				}

				if (self.checked && self.defaultValue === 'voicemail') {
					$(this).closest('.voicemail-wrapper').find('.simple-control-group.voicemail').removeClass('disabled').find('input').prop('checked', true);
					$(this).closest('.voicemail-wrapper').siblings().find('.simple-control-group.phone-number').addClass('disabled').find('input').prop('checked', false);
					$(this).closest('.voicemail-wrapper').siblings('.options').addClass('disabled');

					if (strategy === 'selective') {
						$(this).closest('.voicemail-wrapper').find('.selective-control-group.voicemail').removeClass('disabled');
						$(this).closest('.voicemail-wrapper').siblings().find('.selective-control-group.phone-number').addClass('disabled');
						$(this).closest('.test-append').siblings('.options').addClass('disabled');
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
					hasVmBox = _.get(user, 'smartpbx.call_forwarding.enabled', false),
					hasPhoneNumber = _.has(user, 'call_forward'),
					count = $template.find('.complex-strategy-header').length,
					ruleTemplate = $(self.getTemplate({
						name: 'rule',
						data: {
							number: _.get(user, 'call_forward.selective.number', ''),
							type: hasVmBox ? 'voicemail' : hasPhoneNumber ? 'phoneNumber' : 'voicemail',
							voicemails: data.voicemails,
							selectedVoicemailId: _.get(user, 'smartpbx.call_forward.selective.voicemail', data.voicemails[0]),
							index: count
						},
						submodule: 'usersCallForwarding'
					}));

				$template.find('.test-append').append(ruleTemplate);
				self.renderRulesListingTemplate(self, ruleTemplate, count);
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
				hasMatchList = _.has(user, 'call_forward.selective.rules'),
				defaultVoicemail = _.get(user, ['smartpbx', 'call_forwarding', 'default'], data.voicemails[0].id),
				voicemail = callForwardStrategy === 'off' ? defaultVoicemail : _.get(callForwardData, 'voicemail.value', defaultVoicemail),
				isSkipToVoicemailEnabled = callForwardStrategy === 'off' || callForwardData.type === 'phoneNumber'? false : true;

			if (callForwardData && callForwardData.type === 'phoneNumber') {
				if (callForwardStrategy !== 'selective') {
					self.userUpdateCallflow(user, defaultVoicemail, isSkipToVoicemailEnabled);
				}
				
				_.set(user, 'call_forward', {
					[callForwardStrategy]: {
						enabled: true,
						number: _.get(callForwardData, 'phoneNumber', ''),
						keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
						direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
						require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
						ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
						substitute: false
					}
				});

				_.set(user, 'smartpbx.call_forwarding', {
					enabled: true
				});
			} else {
				_.set(user, 'smartpbx.call_forwarding', {
					enabled: callForwardStrategy !== 'off',
					[callForwardStrategy]: {
						voicemail: voicemail
					},
					default: data.voicemails[0].id
				});

				if (callForwardStrategy === 'off') {
					_.set(user, 'call_forward', {
						enabled: false
					});
				}
				self.userUpdateCallflow(user, voicemail, isSkipToVoicemailEnabled);

				delete user.call_forward;
			};

			return user;
		},

		usersCallForwardingSaveData: function(userData, callback) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: self.accountId,
					userId: userData.id,
					data: userData
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

		updateVoicemail: function(callflow, voicemailId, enabled, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.patch',
				data: {
					accountId: self.accountId,
					callflowId: callflow.id,
					data: {
						flow: {
							children: {
								_: {
									data: {
										id: voicemailId
									}
								}
							},
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

		userUpdateCallflow: function(user, voicemailId, enabled) {
			var self = this,
				userId = user.id,
				callback = user.callback;

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
					self.updateVoicemail(callflow, voicemailId, enabled);
					waterfallCallback(true);
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

		getMatchList: function(callback) {
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

		createUserDefaultMatchList: function(userId, callback) {
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
						owner_id: userId,
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

		createUserMatchList: function(userId, callback) {
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
						owner_id: userId,
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

		createUserTemporalRule: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRules.create',
				data: {
					accountId: self.accountId,
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
		},

		usersCleanUserData: function(userData) {
			var self = this,
				userData = $.extend(true, {}, userData),
				fullName = monster.util.getUserFullName(userData),
				defaultCallerIdName = fullName.substring(0, 15),
				newCallerIDs = {
					caller_id: {
						internal: {
							name: defaultCallerIdName
						}
					}
				};

			userData = $.extend(true, userData, newCallerIDs);
			/* If the user has been removed from the directory */
			if (userData.extra) {
				if (userData.extra.includeInDirectory === false) {
					if ('directories' in userData && userData.extra.mainDirectoryId && userData.extra.mainDirectoryId in userData.directories) {
						delete userData.directories[userData.extra.mainDirectoryId];
					}
				} else {
					userData.directories = userData.directories || {};

					if (userData.extra.mainCallflowId) {
						userData.directories[userData.extra.mainDirectoryId] = userData.extra.mainCallflowId;
					}
				}

				if ('differentEmail' in userData.extra && userData.extra.differentEmail) {
					if ('email' in userData.extra) {
						userData.email = userData.extra.email;
					}
				} else {
					userData.email = userData.username;
				}

				if ('language' in userData.extra) {
					if (userData.extra.language !== 'auto') {
						userData.language = userData.extra.language;
					} else {
						delete userData.language;
					}
				}

				/**
				 * When updating the user type, override existing one with new
				 * user type selected.
				 * Once set the `service` prop should not be removed by the UI.
				 *
				 */
				if (userData.extra.hasOwnProperty('licensedRole')) {
					userData.service = {
						plans: {}
					};
					userData.service.plans[userData.extra.licensedRole] = {
						account_id: monster.config.resellerId,
						overrides: {}
					};
				}
			}

			// if presence_id doesn't have a proper value, delete it and remove the internal callerId
			if (!userData.hasOwnProperty('presence_id') || userData.presence_id === 'unset' || !userData.presence_id) {
				delete userData.presence_id;

				if (userData.caller_id.hasOwnProperty('internal')) {
					delete userData.caller_id.internal.number;
				}
			} else {
				// Always set the Internal Caller-ID Number to the Main Extension/Presence ID
				userData.caller_id.internal.number = userData.presence_id + '';
			}

			if (userData.hasOwnProperty('caller_id_options') && userData.caller_id_options.hasOwnProperty('outbound_privacy') && userData.caller_id_options.outbound_privacy === 'default') {
				delete userData.caller_id_options.outbound_privacy;

				if (_.isEmpty(userData.caller_id_options)) {
					delete userData.caller_id_options;
				}
			}

			if (userData.timezone === 'inherit') {
				delete userData.timezone;
			}

			_.set(userData, 'ui_help.myaccount.showfirstUseWalkthrough', false);
			_.set(userData, 'ui_help.voip.showDashboardWalkthrough', false);
			_.set(userData, 'ui_help.voip.showUsersWalkthrough', false);

			delete userData.include_directory;
			delete userData.features;
			delete userData.extra;
			delete userData[''];
			delete userData.confirm_password;

			return userData;
		}
	};
});
