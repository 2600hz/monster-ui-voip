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
                    return $(self.getTemplate({
                        name: 'layout',
                        data: formatData(data),
                        submodule: 'usersCallForwarding'
                    }));
                };
            
            monster.waterfall([
                getData
            ], function(err, voicemails) {
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
                var $button = $(this);
                    formData = self.usersCallForwardingGetFormData();

                self.usersCallForwardingSaveData({
                    formData: formData,
                    userId: data.user.id
                }, function(err) {
                    if (err) {
                        return monster.ui.toast({
                            type: 'warning',
                            message: self.i18n.active().users.callForwarding.toast.error.save 
                        });
                    }
                    getPopup($button).dialog('close');
                });
            });

            $template.find('.cancel-link').on('click', function() {
                getPopup($(this)).dialog('close');
            });
        },

        usersCallForwardingGetFormData: function() {},
        usersCallForwardingFormatData: function(data) {},
        usersCallForwardingNormalizeData: function(data) {},
        usersCallForwardingSaveData: function(data, callback) {
            var normalizedData = self.usersCallForwardingNormalizeData(data.formData);

            console.log({normalizedData: normalizedData, userId: data.userId});

            // self.callApi({
            //     resource: 'user.patch',
            //     data: {
            //         accountId: self.accountId,
            //         userId: data.userId,
            //         data: normalizedData
            //     },
            //     success: _.partial(callback, null),
            //     error: _.partial(callback, _) 
            // });
        }

    };
});