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
				var userVoicemails = _.filter(voicemails, function(vmbox) {
						return vmbox.owner_id === user.id;
					}),
					data = {
						voicemails: userVoicemails,
						user: user
					},
					callback = data.user.callback;

				monster.waterfall([
					function(waterfallCallback) {
						self.getMatchList(function(matchList) {
							var userMatchLists = _.filter(matchList, function(list) {
								return list.owner_id === data.user.id;
							});

							if (_.isEmpty(userMatchLists)) {
								self.createUserDefaultMatchList(data.user.id, function(createdMatchlist) {
									waterfallCallback(null, createdMatchlist);
								});
							} else {
								waterfallCallback(null, userMatchLists);
							}
						});
					},
					function(userMatchLists, waterfallCallback) {
						var array = !_.isArray(userMatchLists) ? _.wrap(userMatchLists, Array) : userMatchLists;

						self.getUserRulesByMatchListId(array, [], function(matchLists) {
							var rules = [];
							if (!_.isEmpty(matchLists)) {
								_.each(matchLists, function(elem) {
									rules.push(elem.rules);
								});
								rules = _.flatten(rules);
							};
							waterfallCallback(null, rules);
						});
					},
					function(rules, waterfallCallback) {
						self.transforFlowIntoRules(data, function(voicemailRules) {
							if (_.isEmpty(voicemailRules)) {
								waterfallCallback(null, rules);
							} else {
								var allRules = _.concat(rules, voicemailRules);
								_.remove(allRules, function(rule) {
									return rule.name === 'Default Rule';
								});
								waterfallCallback(null, allRules);
							}
						});
					},
					function(rules, waterfallCallback) {
						var mergedRules = self.mergeMatchLists(rules);
						waterfallCallback(null, mergedRules);
					},
					function(mergedRules, waterfallCallback) {
						self.getIntervalsFromRules(mergedRules, function(data) {
							var rulesWithIntervals = self.replaceTemporalRouteIdWithObjects(mergedRules, data);
							waterfallCallback(null, rulesWithIntervals);
						});
					},
					function(rulesWithIntervals, waterfallCallback) {
						var newData = _.set(data, 'match_list_cf', rulesWithIntervals),
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
				var $button = $(this);

				monster.waterfall([
					function(waterfallCallback) {
						var updateData = self.usersCallForwardingGetFormData(data),
							cleanedData = self.usersCleanUserData(updateData);

						waterfallCallback(null, cleanedData);
					},
					function(cleanedData, waterfallCallback) {
						if (_.has(cleanedData, 'call_forward.selective')) {
							self.getMatchList(function(matchList) {
								var userMatchList = _.filter(matchList, function(list) {
									return list.owner_id === cleanedData.id;
								});
								_.each(userMatchList, function(matchList) {
									cleanedData.call_forward.selective.rules.push({
										match_list_id: matchList.id,
										enabled: true
									});
								});

								waterfallCallback(null, cleanedData);
							});
						} else {
							waterfallCallback(null, cleanedData);
						};
					},
					function(cleanedData, waterfallCallback) {
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
						waterfallCallback(true);
					}
				]);
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
						$(div).find('.options').addClass('disabled');
						$(div).find('.simple-control-group.phone-number').addClass('disabled');
						$(div).find('.simple-control-group.voicemail').removeClass('disabled');
						$(div).closest('.simple-strategy').find('input[value="voicemail"]').prop('checked', true);
						if (strategy === 'selective') {
							$(div).closest('.complex-strategy').find('input[value="voicemail"]').prop('checked', true);
						};
					} else if (div.outerHTML.includes(dataStrategyString) && _.has(data.user, ['call_forward', strategy])) {
						$template.find(div).removeClass('disabled');
					} else {
						$template.find(div).addClass('disabled');
					};
				});
			});

			$template.on('change', '.radio-state', function() {
				var self = this,
					strategy = self.name.split('.')[0];

				if (self.checked && self.defaultValue === 'phoneNumber') {
					$(this).closest('.phone-number-wrapper').siblings().find('.simple-control-group.voicemail').addClass('disabled').find('input').prop('checked', true);
					$(this).closest('.phone-number-wrapper').find('.simple-control-group.phone-number').removeClass('disabled').find('input').prop('checked', true);

					$(this).closest('.phone-number-wrapper').siblings('.options').removeClass('disabled');

					if (strategy === 'selective') {
						$(this).closest('.phone-number-wrapper').find('.selective-control-group.phone-number').removeClass('disabled');
						$(this).closest('.phone-number-wrapper').siblings().find('.selective-control-group.voicemail').addClass('disabled');
						$(this).closest('.append-phone-number').siblings('.options').removeClass('disabled');
					}
				}

				if (self.checked && self.defaultValue === 'voicemail') {
					$(this).closest('.voicemail-wrapper').find('.simple-control-group.voicemail').removeClass('disabled').find('input').prop('checked', true);
					$(this).closest('.voicemail-wrapper').siblings().find('.simple-control-group.phone-number').addClass('disabled').find('input').prop('checked', false);
					$(this).closest('.voicemail-wrapper').siblings('.options').addClass('disabled');

					if (strategy === 'selective') {
						$(this).closest('.voicemail-wrapper').find('.selective-control-group.voicemail').removeClass('disabled');
						$(this).closest('.voicemail-wrapper').siblings().find('.selective-control-group.phone-number').addClass('disabled');
						$(this).closest('.append-phone-number').siblings('.options').addClass('disabled');
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
					count = $template.find('.complex-strategy-header').length,
					ruleTemplate = $(self.getTemplate({
						name: 'rule',
						data: {
							from: 'allNumbers',
							type: 'voicemail',
							duration: 'always',
							voicemails: data.voicemails,
							selectedVoicemailId: _.get(user, 'smartpbx.call_forward.selective.voicemail', data.voicemails[0]),
							number: _.get(user, 'call_forward.selective.number', ''),
							index: count
						},
						submodule: 'usersCallForwarding'
					}));

				$template.find('.append-phone-number').append(ruleTemplate);
				self.renderRulesListingTemplate(self, ruleTemplate, count, []);
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
				callback = user.callback,
				formData = monster.ui.getFormData('call_forward_form'),
				callForwardStrategy = formData.call_forwarding_strategy,
				isStategyBusy = callForwardStrategy === 'busy',
				isStrategyOff = callForwardStrategy === 'off',
				isStategyNoAnswer = callForwardStrategy === 'no_answer',
				callForwardData = formData[callForwardStrategy],
				defaultVoicemail = _.get(user, ['smartpbx', 'call_forwarding', 'default'], data.voicemails[0].id),
				voicemail = isStrategyOff ? defaultVoicemail : _.get(callForwardData, 'voicemail.value', defaultVoicemail),
				isSkipToVoicemailEnabled = isStrategyOff || isStategyBusy || isStategyNoAnswer || callForwardData.type === 'phoneNumber' ? false : true;

			if (callForwardStrategy !== 'selective') {
				monster.waterfall([
					function(waterfallCallback) {
						var standardFlow = self.buildStandardFlow(user, voicemail);
						_.set(standardFlow, 'data.skip_module', isSkipToVoicemailEnabled);
						self.resetUserCallFlow(user, standardFlow);
						waterfallCallback(true);
					},
					function(waterfallCallback) {
						self.getMatchList(function(matchList) {
							var userMatchList = _.filter(matchList, function(list) {
								return list.owner_id === user.id;
							});

							waterfallCallback(null, userMatchList);
						});
					},
					function(userMatchList, waterfallCallback) {
						self.deleteOldMatchLists(userMatchList);
						waterfallCallback(null, null);
					},
					function(empty, waterfallCallback) {
						self.createUserDefaultMatchList(user.id);
						waterfallCallback(true);
					}
				]);
			}

			if (callForwardData && callForwardData.type === 'phoneNumber') {
				_.set(user, 'call_forward', {
					[callForwardStrategy]: {
						enabled: true,
						number: _.get(callForwardData, 'phoneNumber', ''),
						keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
						direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
						require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
						ignore_early_media: _.includes(callForwardData.isEnabled, 'ring')
					},
					enabled: true
				});

				_.set(user, 'smartpbx.call_forwarding', {
					enabled: true
				});
			}

			if ((callForwardData && callForwardData.type === 'voicemail') || isStrategyOff) {
				_.set(user, 'smartpbx.call_forwarding', {
					enabled: callForwardStrategy !== 'off',
					[callForwardStrategy]: {
						voicemail: voicemail
					},
					'default': data.voicemails[0].id
				});

				if (isStrategyOff) {
					_.set(user, 'call_forward', {
						enabled: false
					});
				};

				delete user.call_forward;
			}

			// Logic for selective strategy
			if (callForwardStrategy === 'selective') {
				var filterAlwaysRules = _.remove(callForwardData.rule, function(rule) {
						if (rule.from === 'allNumbers' && rule.type === 'voicemail' && rule.length === 'always') {
							return rule;
						}
					}),
					voicemailRules = _.filter(callForwardData.rule, function(rule) {
						if (rule.type === 'voicemail') {
							return rule;
						}
					}),
					phoneNumberRules = _.filter(callForwardData.rule, function(rule) {
						if (rule.type === 'phoneNumber') {
							return rule;
						}
					}),
					standardFlow = self.buildStandardFlow(user, voicemail),
					temporalRouteFlow = self.buildTemporalRoutesFlow(),
					specificFlow = self.buildSpecificFlow(voicemail),
					specificCustomFlow = self.buildSpecificCustomFlow(),
					newFlow = {};

				if (!_.isEmpty(phoneNumberRules)) {
					_.set(user, 'call_forward', {
						selective: {
							enabled: true,
							number: _.get(phoneNumberRules[0], 'phoneNumber', ''),
							keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
							direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
							require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
							ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
							rules: []
						}
					});
				}

				_.set(user, 'smartpbx.call_forwarding', {
					enabled: true,
					selective: {
						voicemail: _.get(voicemailRules[0], 'voicemail.value', defaultVoicemail)
					},
					'default': data.voicemails[0].id
				});

				if (filterAlwaysRules.length <= 0) {
					_.set(standardFlow, 'data.skip_module', false);
				};

				if (_.isEmpty(voicemailRules)) {
					_.set(standardFlow, 'data.skip_module', false);
					self.resetUserCallFlow(user, standardFlow);
				};

				if (_.isEmpty(phoneNumberRules)) {
					monster.waterfall([
						function(waterfallCallback) {
							self.getMatchList(function(matchList) {
								var userMatchList = _.filter(matchList, function(list) {
									return list.owner_id === user.id;
								});

								waterfallCallback(null, userMatchList);
							});
						},
						function(userMatchList, waterfallCallback) {
							self.deleteOldMatchLists(userMatchList);
							waterfallCallback(null, null);
						},
						function(empty, waterfallCallback) {
							self.createUserDefaultMatchList(user.id);
							waterfallCallback(true);
						}
					]);
				};

				//Phonenumber Rules Logic
				if (phoneNumberRules.length > 0) {
					var standardPhoneNumberRules = _.filter(phoneNumberRules, function(rule) {
							if (rule.from === 'allNumbers' && rule.length === 'always') {
								return rule;
							}
						}),
						customPhoneNumberRules = _.filter(phoneNumberRules, function(rule) {
							if (rule.from === 'allNumbers' && rule.length === 'custom') {
								return rule;
							}
						}),
						specificPhoneNumberRules = _.filter(phoneNumberRules, function(rule) {
							if (rule.from === 'specific' && rule.length === 'always') {
								return rule;
							}
						}),
						specificCustomPhoneNumberRules = _.filter(phoneNumberRules, function(rule) {
							if (rule.from === 'specific' && rule.length === 'custom') {
								return rule;
							}
						}),
						customPhoneNumberRulesIntervals,
						specificCustomPhoneNumberRulesIntervals,
						standardMatchlist = {},
						customPhoneNumberMatchList = {},
						specificPhoneNumberMatchList = {},
						specificCustomPhoneNumberMatchList = {};

					monster.waterfall([
						function(waterfallCallback) {
							self.getMatchList(function(matchList) {
								var userMatchList = _.filter(matchList, function(list) {
									return list.owner_id === user.id;
								});

								waterfallCallback(null, userMatchList);
							});
						},
						function(userMatchList, waterfallCallback) {
							self.deleteOldMatchLists(userMatchList);
							waterfallCallback(null, null);
						},
						function(userMatchList, waterfallCallback) {
							if (standardPhoneNumberRules.length > 0) {
								standardMatchlist = self.buildMatchList(user, 'allNumbers', standardPhoneNumberRules, 'standard match list');
								self.createUserMatchList(standardMatchlist);
							};
							waterfallCallback(null, null);
						},
						function(userMatchList, waterfallCallback) {
							if (customPhoneNumberRules.length > 0) {
								customPhoneNumberMatchList = self.buildMatchList(user, 'allNumbers', customPhoneNumberRules, 'custom match list');
								customPhoneNumberRulesIntervals = self.transformIntervalsToRoutes(customPhoneNumberRules);
								self.generateTemporalRoutesForPhoneNumbers(user, customPhoneNumberRulesIntervals, customPhoneNumberMatchList, [], customPhoneNumberRules[0].phoneNumber, 'custom match list');
							};
							waterfallCallback(null, null);
						},
						function(userMatchList, waterfallCallback) {
							if (specificPhoneNumberRules.length > 0) {
								specificPhoneNumberMatchList = self.buildMatchList(user, 'specific', specificPhoneNumberRules, 'specific match list');
								self.createUserMatchList(specificPhoneNumberMatchList);
							};
							waterfallCallback(null, null);
						},
						function(userMatchList, waterfallCallback) {
							if (specificCustomPhoneNumberRules.length > 0) {
								specificCustomPhoneNumberMatchList = self.buildMatchList(user, 'specific', specificCustomPhoneNumberRules, 'specific-custom match list');
								specificCustomPhoneNumberRulesIntervals = self.transformIntervalsToRoutes(specificCustomPhoneNumberRules);
								self.generateTemporalRoutesForPhoneNumbers(user, specificCustomPhoneNumberRulesIntervals, specificCustomPhoneNumberMatchList, [], specificCustomPhoneNumberRules[0].phoneNumber, 'specific-custom match list');
							};
							waterfallCallback(true);
						}
					], callback);
				};

				// Voicemail Flows Logic
				if (voicemailRules.length > 0) {
					var customRules = _.filter(voicemailRules, function(rule) {
							if (rule.from === 'allNumbers' && rule.length === 'custom') {
								return rule;
							}
						}),
						specificRules = _.filter(voicemailRules, function(rule) {
							if (rule.from === 'specific' && rule.length === 'always') {
								return rule;
							}
						}),
						specificCustomRules = _.filter(voicemailRules, function(rule) {
							if (rule.from === 'specific' && rule.length === 'custom') {
								return rule;
							}
						}),
						specificCustomIntervals,
						customRulesIntervals,
						specificCustomNumbers,
						specificRulesNumbers;

					if (specificCustomRules.length > 0) {
						specificCustomIntervals = self.transformIntervalsToRoutes(specificCustomRules);
						specificCustomNumbers = self.transformPhonenumbersToRegex(specificCustomRules);

						_.set(specificCustomFlow, 'data.regex', _.cloneDeep(specificCustomNumbers));
						_.merge(newFlow, specificCustomFlow);
						_.set(newFlow, 'children.match', _.cloneDeep(temporalRouteFlow));
						_.set(newFlow, 'children.match.children._', _.cloneDeep(standardFlow));

						if (specificRules.length > 0) {
							specificRulesNumbers = self.transformPhonenumbersToRegex(specificRules);

							_.set(specificFlow, 'data.regex', _.cloneDeep(specificRulesNumbers));
							_.set(newFlow, 'children.nomatch', _.cloneDeep(specificFlow));

							if (customRules.length > 0) {
								customRulesIntervals = self.transformIntervalsToRoutes(customRules);

								_.set(newFlow, 'children.nomatch.children.nomatch', _.cloneDeep(temporalRouteFlow));
								_.set(newFlow, 'children.nomatch.children.nomatch.children._', _.cloneDeep(standardFlow));
							} else {
								_.set(newFlow, 'children.nomatch.children.nomatch', _.cloneDeep(standardFlow));
							}
						} else if (customRules.length > 0) {
							customRulesIntervals = self.transformIntervalsToRoutes(customRules);

							_.set(newFlow, 'children.nomatch', _.cloneDeep(temporalRouteFlow));
							_.set(newFlow, 'children.nomatch.children._', _.cloneDeep(standardFlow));
						} else {
							_.set(newFlow, 'children.nomatch', _.cloneDeep(standardFlow));
						}
					} else if (specificRules.length > 0 && _.isEmpty(newFlow)) {
						specificRulesNumbers = self.transformPhonenumbersToRegex(specificRules);

						_.set(specificFlow, 'data.regex', _.cloneDeep(specificRulesNumbers));
						_.merge(newFlow, specificFlow);

						if (customRules.length > 0) {
							customRulesIntervals = self.transformIntervalsToRoutes(customRules);

							_.set(newFlow, 'children.nomatch', _.cloneDeep(temporalRouteFlow));
							_.set(newFlow, 'children.nomatch.children._', _.cloneDeep(standardFlow));
						} else {
							_.set(newFlow, 'children.nomatch', _.cloneDeep(standardFlow));
						}
					} else if (customRules.length > 0 && _.isEmpty(newFlow)) {
						customRulesIntervals = self.transformIntervalsToRoutes(customRules);

						_.merge(newFlow, _.cloneDeep(temporalRouteFlow));
						_.set(newFlow, 'children._', _.cloneDeep(standardFlow));
					}

					if (!_.isEmpty(specificCustomIntervals)) {
						if (!_.isEmpty(specificRules)) {
							if (!_.isEmpty(customRules)) {
								self.generateTemporalRoutesForVoicemail(newFlow, user, specificCustomIntervals, [], 'children.match.children', voicemail, function(data) {
									self.generateTemporalRoutesForVoicemail(data.flow, user, customRulesIntervals, [], 'children.nomatch.children.nomatch.children', voicemail, function(data) {
									});
								});
							} else {
								self.generateTemporalRoutesForVoicemail(newFlow, user, specificCustomIntervals, [], 'children.match.children', voicemail, function(data) {
								});
							}
						} else if (!_.isEmpty(customRules)) {
							self.generateTemporalRoutesForVoicemail(newFlow, user, specificCustomIntervals, [], 'children.match.children', voicemail, function(data) {
								self.generateTemporalRoutesForVoicemail(data.flow, user, customRulesIntervals, [], 'children.nomatch.children', voicemail, function(data) {
								});
							});
						} else {
							self.generateTemporalRoutesForVoicemail(newFlow, user, specificCustomIntervals, [], 'children.match.children', voicemail, function(data) {
							});
						}
					} else if (!_.isEmpty(specificRules)) {
						if (!_.isEmpty(customRules)) {
							self.generateTemporalRoutesForVoicemail(newFlow, user, customRulesIntervals, [], 'children.nomatch.children', voicemail, function(data) {
							});
						} else {
							self.updateFlow(user, newFlow);
						};
					} else if (!_.isEmpty(customRules)) {
						self.generateTemporalRoutesForVoicemail(newFlow, user, customRulesIntervals, [], 'children', voicemail, function(data) {
						});
					};
				};
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

		skipToVoicemail: function(callflow, enabled, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.patch',
				data: {
					accountId: self.accountId,
					callflowId: callflow.id,
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

		userUpdateVoicemailCallflow: function(user, voicemailId, enabled) {
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
					filters: {
						paginate: 'false'
					},
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

		createUserMatchList: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'matchList.create',
				data: {
					accountId: self.accountId,
					data: data
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
				resource: 'temporalRule.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(temporalRuleData) {
					callback && callback(temporalRuleData.data);
				}
			});
		},

		getUserTemporalRule: function(ruleId, callback) {
			var self = this;

			self.callApi({
				resource: 'temporalRule.get',
				data: {
					accountId: self.accountId,
					ruleId: ruleId
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

		renderRulesListingTemplate: function(data, template, ruleIndex, customIntervals) {
			var self = data,
				meta = self.appFlags.strategyHours.intervals,
				timepickerStep = meta.timepicker.step,
				intervalLowerBound = meta.min,
				intervalUpperBound = meta.max,
				filledCustomIntervals = self.fillMissingDays(customIntervals),
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
						intervals: !_.isEmpty(customIntervals) ? filledCustomIntervals : intervals,
						ruleIndex: ruleIndex
					},
					submodule: 'usersCallForwarding'
				}));

			_.forEach(!_.isEmpty(customIntervals) ? filledCustomIntervals : intervals, function(interval, index) {
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

			_.each($(template).find('.office-hours-wrapper'), function(elem, index) {
				if (ruleIndex === index) {
					$(elem).append(listingTemplate);
				}

				if ($(elem).hasClass('disabled')) {
					$(elem).append(listingTemplate);
				}
			});
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
		},

		fillMissingDays: function(intervals) {
			var daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
				filledIntervals = [];

			for (var i = 0; i < daysOfWeek.length; i++) {
				var day = daysOfWeek[i],
					existingInterval = null;

				for (var j = 0; j < intervals.length; j++) {
					if (intervals[j].weekday === day) {
						existingInterval = intervals[j];
						break;
					}
				}

				if (existingInterval) {
					filledIntervals.push({
						weekday: day,
						start: existingInterval.start,
						end: existingInterval.end,
						active: existingInterval.active
					});
				} else {
					filledIntervals.push({
						weekday: day,
						start: 0,
						end: 84600,
						active: false
					});
				}
			}

			return filledIntervals;
		},

		updateFlow: function(user, flow, callback) {
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
					_.set(callflow, 'flow', flow);
					self.callApi({
						resource: 'callflow.update',
						data: {
							accountId: self.accountId,
							callflowId: callflow.id,
							data: callflow
						},
						success: function(callflowData) {
							callback && callback(callflowData.data);
						}
					});
				}
			], callback);
		},

		regexFromArray: function(numbers) {
			var regexArr = ['^('];

			for (var i = 0; i < numbers.length; i++) {
				regexArr.push(numbers[i].toString());
				if (i < numbers.length - 1) {
					regexArr.push('|');
				}
			};

			regexArr.push(')$');
			return regexArr.join('');
		},

		regexToArray: function(regexString) {
			var result = [];
			if (regexString && regexString !== '^()$' && regexString !== '^+1d{10}$') {
				var groups = regexString.match(/\(([^)]+)\)/g);
				for (var i = 0; i < groups.length; i++) {
					var group = groups[i];
					var numbers = group.slice(1, -1).split('|');

					result = result.concat(numbers);
				}
			}

			return result;
		},

		formatRulesData: function(rules) { //here
			var self = this,
				rulesArray = [];

			_.forEach(rules, function(rule, index) {
				if (rule.type !== 'voicemail') {
					var data = {
						from: 'rule-' + rule.length + rule.phoneNumber,
						type: rule.length === 'always' ? 'regex' : 'temporal_route',
						target: rule.phoneNumber,
						regex: rule.from === 'specific ' && self.regexToArray(rule.phoneNumbers),
						intervals: self.transformIntervals(rule.intervals)
					};

					rulesArray.push(data);
				}
			});

			return rulesArray;
		},

		transformIntervals: function(intervals) {
			var daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
			var dayIntervals = {};
			var result = [];

			for (var i = 0; i < intervals.length; i++) {
				var interval = intervals[i];

				if (!interval.active) {
					continue;
				}

				var dayIndex = daysOfWeek.indexOf(interval.weekday);
				var start = interval.start.split(':');
				var end = interval.end.split(':');
				var startSeconds = parseInt(start[0]) * 3600 + parseInt(start[1]) * 60;
				var endSeconds = parseInt(end[0]) * 3600 + parseInt(end[1]) * 60;

				if (!dayIntervals[dayIndex]) {
					dayIntervals[dayIndex] = {
						start: startSeconds,
						end: endSeconds
					};
				} else {
					dayIntervals[dayIndex].start = Math.min(dayIntervals[dayIndex].start, startSeconds);
					dayIntervals[dayIndex].end = Math.max(dayIntervals[dayIndex].end, endSeconds);
				}
			}

			for (var i = 0; i < daysOfWeek.length; i++) {
				var currentDay = [daysOfWeek[i]];
				var currentInterval = dayIntervals[i];

				if (currentInterval) {
					var start = currentInterval.start;
					var end = currentInterval.end;

					for (var j = i + 1; j < daysOfWeek.length; j++) {
						var nextDay = daysOfWeek[j];
						var nextInterval = dayIntervals[j];

						if (nextInterval && currentInterval.start === nextInterval.start && currentInterval.end === nextInterval.end) {
							currentDay.push(nextDay);
							delete dayIntervals[j];
						}
					}

					result.push({
						name: 'weekly temporal rule for selective',
						wdays: currentDay,
						time_window_start: start,
						time_window_stop: end,
						cycle: 'weekly'
					});
				}
			}

			return result;
		},

		transforFlowIntoRules: function(data, callback) {
			var self = this;

			self.getUserCallflow(data.user.id, function(flow) {
				var voicemailRules = [];
				if (_.get(flow.flow, 'module') === 'check_cid') {
					if (_.get(flow.flow, 'children.match.module') === 'temporal_route') {
						voicemailRules.push({
							from: 'specific',
							type: 'voicemail',
							duration: 'custom',
							voicemails: data.voicemails,
							selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
							number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
							regex: _.get(flow.flow, 'data.regex'),
							temporal_route_id: _.remove(_.keys(flow.flow.children.match.children), function(key) { return key !== '_'; })
						});

						if (_.get(flow.flow, 'children.nomatch.module') === 'check_cid') {
							voicemailRules.push({
								from: 'specific',
								type: 'voicemail',
								duration: 'always',
								voicemails: data.voicemails,
								selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
								number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
								regex: _.get(flow.flow, 'children.nomatch.data.regex')
							});

							if (_.get(flow.flow, 'children.nomatch.children.nomatch.module') === 'temporal_route') {
								voicemailRules.push({
									from: 'allNumbers',
									type: 'voicemail',
									duration: 'custom',
									voicemails: data.voicemails,
									selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
									number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
									regex: '^+1d{10}$',
									temporal_route_id: _.remove(_.keys(flow.flow.children.nomatch.children.nomatch.children), function(key) { return key !== '_'; })
								});
							}
						} else if (_.get(flow.flow, 'children.nomatch.module') === 'temporal_route') {
							voicemailRules.push({
								from: 'allNumbers',
								type: 'voicemail',
								duration: 'custom',
								voicemails: data.voicemails,
								selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
								number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
								regex: '^+1d{10}$',
								temporal_route_id: _.remove(_.keys(flow.flow.children.nomatch.children), function(key) { return key !== '_'; })
							});
						}
					} else if (_.get(flow.flow, 'children.match.module') === 'voicemail') {
						voicemailRules.push({
							from: 'specific',
							type: 'voicemail',
							duration: 'always',
							voicemails: data.voicemails,
							selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
							number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
							regex: _.get(flow.flow, 'data.regex'),
							temporal_route_id: _.remove(_.keys(flow.flow.children.match.children), function(key) { return key !== '_'; })
						});

						if (_.get(flow.flow, 'children.nomatch.module') === 'temporal_route') {
							voicemailRules.push({
								from: 'allNumbers',
								type: 'voicemail',
								duration: 'custom',
								voicemails: data.voicemails,
								selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
								number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
								regex: '^+1d{10}$',
								temporal_route_id: _.remove(_.keys(flow.flow.children.nomatch.children), function(key) { return key !== '_'; })
							});
						}
					}
				} else if (_.get(flow.flow, 'module') === 'temporal_route') {
					voicemailRules.push({
						from: 'allNumbers',
						type: 'voicemail',
						duration: 'custom',
						voicemails: data.voicemails,
						selectedVoicemailId: _.get(data.user, ['smartpbx', 'call_forwarding', 'selective', 'voicemail'], data.voicemails[0]),
						number: _.get(data.user, ['call_forward', 'selective', 'number'], ''),
						regex: '^+1d{10}$',
						temporal_route_id: _.remove(_.keys(flow.flow.children), function(key) { return key !== '_'; })
					});
				}

				callback(voicemailRules);
			});
		},

		getIntervalsFromRules: function(array, callback) {
			var self = this,
				filteredArray = _.filter(array, function(elem) {
					return _.has(elem, 'temporal_route_id') && _.get(elem, 'temporal_route_id') && !_.isEmpty(elem.temporal_route_id);
				});

			if (!_.isEmpty(filteredArray)) {
				self.getIntervals(filteredArray, [], function(data) {
					var transformedArray = self.transformArray(data);
					callback(transformedArray);
				});
			} else {
				callback(array);
			}
		},

		replaceTemporalRouteIdWithObjects: function(a, b) {
			var idToIntervalMap = _.keyBy(b, 'id'),
				result = a.map(item => {
					if (item.temporal_route_id) {
						var mergedId = item.temporal_route_id.map(id => idToIntervalMap[id]),
							mergedIntervals = mergedId.reduce((merged, id) => {
								merged.id.push(id.id);
								merged.intervals.push(...id.intervals);
								return merged;
							}, { id: [], intervals: [] });

						item.temporal_route_id = [mergedIntervals];
					}

					if (item.selectedVoicemailId) {
						item.voicemails = [/* Assuming you have the corresponding voicemail object here */];
						delete item.selectedVoicemailId;
					}

					return item;
				});

			return result;
		},

		getIntervals: function(array, intervalData, callback) {
			var self = this,
				id = array[0].temporal_route_id;

			if (_.size(id) > 1 && _.isArray(id)) {
				id = array[0].temporal_route_id[0];
				_.each(_.tail(array[0].temporal_route_id), function(value) {
					array.push({
						temporal_route_id: value
					});
				});
			}

			self.getUserTemporalRule(id, function(data) {
				var newArray = _.tail(array);

				intervalData.push({
					id: data.id,
					end: data.time_window_stop,
					start: data.time_window_start,
					wdays: data.wdays
				});

				if (!_.isEmpty(newArray)) {
					self.getIntervals(newArray, intervalData, callback);
				} else {
					callback(intervalData);
				}
			});
		},

		transformArray: function(inputArray) {
			return _.map(inputArray, item => {
				var intervals = _.map(item.wdays, weekday => ({
					weekday,
					start: item.start,
					end: item.end,
					active: true
				}));

				return {
					id: item.id,
					intervals
				};
			});
		},

		mergeMatchLists: function(array) {
			var groupedByName = _.groupBy(array, 'name'),
				mergedArray = [];

			_.forEach(groupedByName, (group) => {
				var mergedObject = _.mergeWith({}, ...group, (objValue, srcValue, key) => {
					if (key === 'temporal_route_id') {
						return _.concat(objValue || [], srcValue);
					}
				});
				mergedArray.push(mergedObject);
			});

			return mergedArray;
		},

		getUserCallflow: function(userId, callback) {
			var self = this;

			monster.waterfall([
				function(waterfallCallback) {
					self.getCallflowList(userId, function(callflowList) {
						waterfallCallback(null, callflowList[0].id);
					});
				},
				function(callflowId, waterfallCallback) {
					self.getCallflow(callflowId, function(callflow) {
						callback && callback(callflow);
					});
				}
			], callback);
		},

		resetUserCallFlow: function(user, flow) {
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
					var isFlowsEqual = _.isEqual(callflow.flow, flow);
					if (!isFlowsEqual) {
						_.set(callflow, 'flow', flow);
						self.callApi({
							resource: 'callflow.update',
							data: {
								accountId: self.accountId,
								callflowId: callflow.id,
								data: callflow
							},
							success: function(callflowData) {
								callback && callback(callflowData.data);
							}
						});
					}
					waterfallCallback(true);
				}
			], callback);
		},

		getUserRulesByMatchListId: function(userMatchList, dataArray, callback) {
			var self = this,
				newArray = [];

			newArray = _.tail(userMatchList);
			if (!_.isEmpty(userMatchList)) {
				self.getUserMatchList(userMatchList[0].id, function(data) {
					dataArray.push(data);
					self.getUserRulesByMatchListId(newArray, dataArray, callback);
				});
			} else {
				callback(dataArray);
			};
		},

		updateUserWithMatchList: function(user, callback) {
			var self = this;

			monster.waterfall([
				function(waterfallCallback) {
					self.getMatchList(function(matchList) {
						var userMatchList = _.filter(matchList, function(list) {
							return list.owner_id === user.id;
						});

						waterfallCallback(null, userMatchList);
					});
				},
				function(matchList, waterfallCallback) {
					_.set(user, 'call_forward.selective.rules', matchList);
					callback(null, user);
				}
			], callback);
		},

		generateTemporalRoutesForPhoneNumbers: function(user, intervals, matchList, idsArray, phoneNumber, matchListType) {
			var self = this;

			self.createUserTemporalRule(intervals[0], function(routeData) {
				var newIntervals = _.tail(intervals);
				idsArray.push(routeData.id);
				if (!_.isEmpty(newIntervals)) {
					self.generateTemporalRoutesForPhoneNumbers(user, newIntervals, matchList, idsArray, phoneNumber, matchListType);
				} else {
					self.createCustomMatchList(user, matchList, idsArray, phoneNumber, matchListType);
				}
			});
		},

		deleteOldMatchLists: function(matchLists) {
			var self = this;

			self.deleteUserMatchList(matchLists[0].id, function(deletedData) {
				var newMatchLists = _.tail(matchLists);
				if (!_.isEmpty(newMatchLists)) {
					self.deleteOldMatchLists(newMatchLists);
				};
			});
		},

		createCustomMatchList: function(user, matchList, idsArray, phoneNumber, matchListType, callback) {
			var self = this;

			_.each(idsArray, function(ruleId) {
				matchList.rules.push({
					name: matchListType + ' for: ' + phoneNumber,
					type: 'temporal_route',
					temporal_route_id: ruleId
				});
			});

			self.callApi({
				resource: 'matchList.create',
				data: {
					owner_id: user.id,
					accountId: self.accountId,
					data: matchList
				},
				success: function(matchListData) {
					callback && callback(matchListData.data);
				}
			});
		},

		buildMatchList: function(user, type, phoneNumberRules, matchListType) {
			var self = this,
				matchList = {
					name: matchListType + ' for: ' + phoneNumberRules[0].phoneNumber,
					owner_id: user.id,
					rules: [
						{
							name: matchListType + ' for: ' + phoneNumberRules[0].phoneNumber,
							regex: type === 'allNumbers' ? '^+1d{10}$' : self.transformPhonenumbersToRegex(phoneNumberRules),
							type: 'regex'
						}
						// Temporal Rules if applicable
					]
				};

			return matchList;
		},

		buildStandardFlow: function(user, voicemailId) {
			var flow = {
				module: 'user',
				data: {
					id: user.id,
					timeout: 20,
					can_call_self: false,
					delay: 0,
					strategy: 'simultaneous',
					skip_module: true
				},
				children: {
					_: {
						module: 'voicemail',
						data: {
							id: voicemailId,
							action: 'compose',
							callerid_match_login: false,
							interdigit_timeout: 2000,
							max_message_length: 500,
							single_mailbox_login: false
						},
						children: {}
					}
				}
			};

			return flow;
		},

		buildSpecificFlow: function(voicemailId) {
			var flow = {
				module: 'check_cid',
				data: {
					use_absolute_mode: false,
					regex: []
				},
				children: {
					match: {
						module: 'voicemail',
						data: {
							id: voicemailId,
							action: 'compose',
							callerid_match_login: false,
							interdigit_timeout: 2000,
							max_message_length: 500,
							single_mailbox_login: false
						},
						children: {}
					},
					nomatch: {
						// standard flow here
					}
				}
			};

			return flow;
		},

		buildSpecificCustomFlow: function() {
			var flow = {
				module: 'check_cid',
				data: {
					use_absolute_mode: false,
					regex: []
				},
				children: {
					match: {
						// temporal route flow  here
						// inside standard flow with routes ids
					},
					nomatch: {
						//standard flow here
					}
				}
			};

			return flow;
		},

		buildTemporalRoutesFlow: function() {
			var flow = {
				module: 'temporal_route',
				data: {},
				children: {
					_: {
						//standard flow here
					}
					//ids here
				}
			};

			return flow;
		},

		generateTemporalRoutesForVoicemail: function(flow, user, intervals, idsArray, path, voicemailId, callback) {
			var self = this;

			self.createUserTemporalRule(intervals[0], function(routeData) {
				var newIntervals = _.tail(intervals);
				idsArray.push(routeData.id);
				if (!_.isEmpty(newIntervals)) {
					self.generateTemporalRoutesForVoicemail(flow, user, newIntervals, idsArray, path, voicemailId, callback);
				} else {
					self.updateFlowWithIntervals(flow, user, idsArray, path, voicemailId, function(data) {
						callback(data);
					});
				}
			});
		},

		updateFlowWithIntervals: function(flow, user, idsArray, path, voicemailId, callback) {
			var self = this,
				userId = user.id,
				data = {
					data: {
						id: voicemailId,
						action: 'compose',
						callerid_match_login: false,
						interdigit_timeout: 2000,
						max_message_length: 500,
						single_mailbox_login: false
					},
					module: 'voicemail',
					children: {}
				},
				nestedProperty = _.get(flow, path),
				clonedProperty = _.cloneDeep(nestedProperty),
				clonedFlow = _.cloneDeep(flow);

			_.each(idsArray, function(id) {
				_.set(clonedProperty, id, data);
			});

			_.set(clonedFlow, path, clonedProperty);

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
					// If para borrar los temporal rules si ya se tiene el module "temporal_route"
					_.defaults({}, clonedFlow, callflow);
					_.set(callflow, 'flow', clonedFlow);
					self.callApi({
						resource: 'callflow.update',
						data: {
							accountId: self.accountId,
							callflowId: callflow.id,
							data: callflow
						},
						success: function(callflowData) {
							callback && callback(callflowData.data);
						}
					});
				}
			]);
		},

		transformIntervalsToRoutes: function(rules) {
			var self = this,
				arr = [];

			_.each(rules, function(rule) {
				arr.push(rule.intervals);
			});

			arr = _.flatten(arr);
			arr = self.transformIntervals(arr);

			return arr;
		},

		transformPhonenumbersToRegex: function(rules) {
			var self = this,
				arr = [];

			_.each(rules, function(rule) {
				arr.push(rule.phoneNumbers);
			});

			arr = _.flatten(arr);
			arr = self.regexFromArray(arr);

			return arr;
		}
	};
});
