define(function (require) {
    var _ = require('lodash');
    var monster = require('monster');

    return {
        usersCallForwardingRender: function (user) {
            var self = this,
                days = self.weekdays,
                meta = self.appFlags.strategyHours.intervals,
                timepickerStep = meta.timepicker.step,
                intervalLowerBound = meta.min,
                intervalUpperBound = meta.max,
                intervals = [
                    {
                        weekday: "monday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                    {
                        weekday: "tuesday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                    {
                        weekday: "wednesday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                    {
                        weekday: "thursday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                    {
                        weekday: "friday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                    {
                        weekday: "saturday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                    {
                        weekday: "sunday",
                        start: 0,
                        end: 84600,
                        active: true
                    },
                ],
                getData = _.bind(self.usersCallForwardingGetData, self),
                formatData = _.bind(self.usersCallForwardingFormatData, self),
                bindEvents = _.bind(self.usersCallForwardingBindingEvents, self),
                initTemplate = function (data) {
                    layoutTemplate = $(self.getTemplate({
                        name: 'layout',
                        data: formatData(data),
                        submodule: 'usersCallForwarding'
                    }));

                    layoutTemplate.find('.feature-popup-title').each(function () {
                        var strategy = $(this).data('template');

                        if (strategy != 'off' || strategy != 'selective') {
                            var simpleStrategyTemplate = $(self.getTemplate({
                                name: 'simpleStrategy',
                                data: {
                                    strategy: strategy,
                                    enabled: _.get(user, 'call_forward.enabled', false),
                                    number: _.get(user, 'call_forward.number', ''),
                                    type: _.get(user, ['call_forward', strategy, 'type'], 'voicemail'),
                                    voicemails: data.voicemails,
                                    user: user,
                                },
                                submodule: 'usersCallForwarding'
                            }));
                            $(this).find('.simple-strategy').append(simpleStrategyTemplate);
                        }

                        if (strategy == 'selective') {
                            var complexStrategyTemplate = $(self.getTemplate({
                                name: 'complexStrategy',
                                data: {
                                    strategy: strategy,
                                    enabled: _.get(user, 'call_forward.enabled', false),
                                    number: _.get(user, 'call_forward.number', ''),
                                    type: _.get(user, ['call_forward', strategy, 'type'], 'voicemail'),
                                    voicemails: data.voicemails,
                                    user: user,
                                },
                                submodule: 'usersCallForwarding'
                            })),
                                listingTemplate = $(self.getTemplate({
                                    name: 'listing',
                                    data: {
                                        strategy: strategy,
                                        intervals: intervals,
                                    },
                                    submodule: 'usersCallForwarding'
                                }));

                            _.forEach(intervals, function (interval, index) {
                                var $startPicker = listingTemplate.find('input[name="' + strategy + '.intervals[' + index + '].start"]'),
                                    $endPicker = listingTemplate.find('input[name="' + strategy + '.intervals[' + index + '].end"]'),
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

                            $(this).find('.complex-strategy').append(complexStrategyTemplate);
                            $(this).find('.office-hours-wrapper').append(listingTemplate);
                        }

                    })

                    return layoutTemplate;
                };

            monster.waterfall([
                getData
            ], function (err, voicemails) {
                var data = {
                    voicemails: voicemails,
                    user: user
                },
                    $template = initTemplate(data);

                bindEvents($template, data);

                monster.ui.dialog($template, {
                    title: user.extra.mapFeatures.call_forwarding.title,
                    position: ['center', 20]
                });
            });
        },

        usersCallForwardingGetData: function (callback) {
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

        usersCallForwardingBindingEvents: function ($template, data) {
            var self = this,
                getPopup = function ($node) {
                    return $node.parents('.ui-dialog-content');
                },
                container = $template.find('.feature-popup-title');

            $template.find('.save').on('click', function () {
                var $button = $(this);
                updateData = self.usersCallForwardingGetFormData(data);

                self.usersCallForwardingSaveData({
                    data: updateData,
                    userId: data.user.id
                }, function (err) {
                    if (err) {
                        return monster.ui.toast({
                            type: 'warning',
                            message: self.i18n.active().users.callForwarding.toast.error.save
                        });
                    }
                    getPopup($button).dialog('close');
                });
            });

            $template.find('.cancel-link').on('click', function () {
                getPopup($(this)).dialog('close');
            });

            $template.find('.switch-state').on('change', function () {
                var self = this,
                    strategy = self.parentElement.parentElement.parentElement.attributes['data-template'] ? self.parentElement.parentElement.parentElement.attributes['data-template'].value : self.parentElement.parentElement.parentElement.parentElement.attributes['data-template'].value,
                    dataStrategyString = 'data-strategy=\"' + strategy + '\"',
                    simpleStrategyContainers = $template.find('.simple-strategy'),
                    complexStrategyContainer = $template.find('.complex-strategy');

                simpleStrategyContainers.push(complexStrategyContainer[0]);

                _.forEach(simpleStrategyContainers, function (div) {
                    if (div.outerHTML.includes(dataStrategyString)) {
                        $template.find(div).removeClass('disabled')
                    } else {
                        $template.find(div).addClass('disabled')
                    }
                })
            })

            $template.find('.radio-state').on('change', function () {
                var self = this,
                    strategy = self.name.split('.')[0],
                    options = $template.find('.option[strategy=' + strategy + ']');

                if (self.checked && self.defaultValue == 'phoneNumber') {
                    _.each(options, function (div) {
                        $template.find(div).removeClass('disabled').find('input')
                    })
                    if (strategy == 'selective') {
                        $template.find('.selective-control-group.voicemail').addClass('disabled')
                        $template.find('.selective-control-group.phone-number').removeClass('disabled')
                    }
                }

                if (self.checked && self.defaultValue == 'voicemail') {
                    _.each(options, function (div) {
                        if (div.children[0].innerText != 'Forward direct calls only') {
                            $template.find(div).addClass('disabled').find('input').prop('checked', false)
                        }
                    })

                    if (strategy == 'selective') {
                        $template.find('.selective-control-group.phone-number').addClass('disabled')
                        $template.find('.selective-control-group.voicemail').removeClass('disabled')
                    }
                }

                if (self.checked && self.defaultValue == 'custom') {
                    $template.find('.office-hours-wrapper').removeClass('disabled')
                } else if (self.checked && self.defaultValue == 'always') {
                    $template.find('.office-hours-wrapper').addClass('disabled')
                }

                if (self.checked) {
                    self.defaultValue == 'allNumbers' && $template.find('.selective-control-group.specific').addClass('disabled').find('input').prop('checked', false);
                    self.defaultValue == 'specific' && $template.find('.selective-control-group.specific').removeClass('disabled').find('input').prop('checked', true)
                }

            })

            $template.find('.add-phone-number').on('click', function () {
                var self = this,
                    count = $(self).closest('.selective-control-group').find('.controls').length,
                    containerToAppend = $template.find('.specific-phone-number-wrapper'),
                    numberContainer = $template.find('.specific-phone-number-wrapper')[0].children[1].outerHTML;
                if (count < 10) {
                    $(containerToAppend[0]).append(numberContainer);
                }
            })


            $template.on('click', '.remove-button', function () {
                var count = $(this).closest('.specific-phone-number-wrapper').find('.controls.specific-controls').length;
                if (count > 1) {
                    $(this).closest('.controls.specific-controls').remove();
                }
            })
        },

        usersCallForwardingGetFormData: function (data) {
            var self = this,
                user = data.user,
                formData = monster.ui.getFormData('call_forward_form'),
                callForwardStrategy = formData['call_forwarding_strategy'],
                callForwardData = formData[callForwardStrategy],
                strategies = ['unconditional', 'busy', 'no_answer', 'selective'],
                updatedPayload = {
                    call_forward: callForwardStrategy == 'off' ? {
                        enabled: false
                    } : {
                        enabled: _.get(user, 'call_forward.enabled', false),
                        keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
                        direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
                        require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
                        ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
                        substitute: false,
                        number: callForwardData.phoneNumber,
                        [callForwardStrategy]: {
                            enabled: callForwardStrategy !== 'off',
                            type: callForwardData.type
                        }
                    }
                },
                selectivePayload = {
                    call_forward: callForwardStrategy == 'off' ? {
                        enabled: false
                    } : {
                        enabled: _.get(user, 'call_forward.enabled', false),
                        keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
                        direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
                        require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
                        ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
                        substitute: false,
                        number: callForwardData.phoneNumber,
                        [callForwardStrategy]: {
                            enabled: true,
                            type: callForwardData.type,
                            rules: [
                                {
                                    enabled: true,
                                    match_list_id: '',
                                    direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
                                    ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
                                    keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
                                    require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
                                }
                            ],
                            direct_calls_only: _.includes(callForwardData.isEnabled, 'forward'),
                            ignore_early_media: _.includes(callForwardData.isEnabled, 'ring'),
                            keep_caller_id: _.includes(callForwardData.isEnabled, 'keep'),
                            require_keypress: _.includes(callForwardData.isEnabled, 'acknowledge'),
                        }
                    }
                }

            formattedCallForwardData = self.usersCallForwardingFormatData(data);

            _.forEach(strategies, function (value) {
                if (value !== callForwardStrategy) {
                    _.assign(callForwardStrategy == 'selective' ? selectivePayload.call_forward : updatedPayload.call_forward, {
                        [value]: {
                            enabled: false
                        }
                    });
                }
            });

            callForwardStrategy !== 'off' && _.assign(user, {
                enableVmbox: formData[callForwardStrategy].type == 'voicemail',
            })

            self.usersUpdateVMBoxStatusInCallflow(user);

            return callForwardStrategy == 'selective' ? selectivePayload : updatedPayload;
        },

        usersCallForwardingFormatData: function (data) {
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

        usersCallForwardingSaveData: function (data, callback) {
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

        usersListVMBoxes: function (args) {
            var self = this;

            self.callApi({
                resource: 'voicemail.list',
                data: _.merge({
                    accountId: self.accountId,
                    filters: {
                        paginate: 'false'
                    }
                }, args.data),
                success: function (data) {
                    args.hasOwnProperty('success') && args.success(data.data);
                },
                error: function (parsedError) {
                    args.hasOwnProperty('error') && args.error(parsedError);
                }
            });
        },

        usersUpdateVMBoxStatusInCallflow: function (data) {
            var self = this,
                userId = data.id,
                enabled = data.enableVmbox,
                callback = data.callback;

            monster.waterfall([
                function (waterfallCallback) {
                    self.usersGetMainCallflow(userId, function (callflow) {
                        waterfallCallback(null, callflow);
                    });
                },
                function (callflow, waterfallCallback) {
                    var flow = self.usersExtractDataFromCallflow({
                        callflow: callflow,
                        module: 'voicemail'
                    });

                    if (flow) {
                        // Module already exists in callflow
                        flow.data.skip_module = enabled;

                        self.usersUpdateCallflow(callflow, function () {
                            waterfallCallback(null);
                        });
                    } else {
                        // Module does not exist in callflow, but should, so err
                        waterfallCallback(true);
                    }
                }
            ], callback);
        },

        usersGetMainCallflow: function (userId, callback) {
            var self = this;

            self.usersListCallflowsUser(userId, function (listCallflows) {
                var indexMain = -1;

                _.each(listCallflows, function (callflow, index) {
                    if (callflow.type === 'mainUserCallflow' || !('type' in callflow)) {
                        indexMain = index;
                        return false;
                    }
                });

                if (indexMain === -1) {
                    // monster.ui.toast({
                    // 	type: 'error',
                    // 	message: self.i18n.active().users.noUserCallflow
                    // });
                    callback(null);
                } else {
                    self.callApi({
                        resource: 'callflow.get',
                        data: {
                            accountId: self.accountId,
                            callflowId: listCallflows[indexMain].id
                        },
                        success: function (data) {
                            callback(data.data);
                        },
                        error: function () {
                            callback(listCallflows[indexMain]);
                        }
                    });
                }
            });
        },

        usersListCallflowsUser: function (userId, callback) {
            var self = this;

            self.callApi({
                resource: 'callflow.list',
                data: {
                    accountId: self.accountId,
                    filters: {
                        filter_owner_id: userId,
                        paginate: 'false'
                    }
                },
                success: function (data) {
                    callback(data.data);
                }
            });
        },

        usersExtractDataFromCallflow: function (args) {
            var self = this,
                flow = _.get(args, 'callflow.flow'),
                cfModule = args.module;

            if (_.isNil(flow)) {
                return undefined;
            }

            while (flow.module !== cfModule && _.has(flow.children, '_')) {
                flow = flow.children._;
            }

            if (flow.module !== cfModule) {
                return undefined;
            } else if (_.has(args, 'dataPath')) {
                return _.get(flow, args.dataPath);
            } else {
                return flow;
            }
        },

        usersUpdateCallflow: function (callflow, callback) {
            var self = this;

            self.callApi({
                resource: 'callflow.update',
                data: {
                    accountId: self.accountId,
                    callflowId: callflow.id,
                    data: callflow
                },
                success: function (callflowData) {
                    callback && callback(callflowData.data);
                }
            });
        },

    };
});