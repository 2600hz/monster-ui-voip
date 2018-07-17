define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		toastr = require('toastr'),
		timezone = require('monster-timezone');

	var app = {

		requests: {},

		subscribe: {
			'voip.vmboxes.render': 'vmboxesRender'
		},

		/* Users */
		/* args: parent and voicemailId */
		vmboxesRender: function(args) {
			var self = this,
				args = args || {},
				parent = args.parent || $('.right-content'),
				_voicemailId = args.voicemailId || '',
				callback = args.callback;

			self.vmboxesGetData(function(data) {
				var dataTemplate = self.vmboxesFormatListData(data),
					template = $(self.getTemplate({
						name: 'layout',
						data: dataTemplate,
						submodule: 'vmboxes'
					})),
					templateVMBox;

				_.each(dataTemplate.vmboxes, function(vmbox) {
					templateVMBox = $(self.getTemplate({
						name: 'row',
						data: vmbox,
						submodule: 'vmboxes'
					}));

					template.find('.vmboxes-rows').append(templateVMBox);
				});

				self.vmboxesBindEvents(template, parent, dataTemplate);

				parent
					.empty()
					.append(template);

				if (_voicemailId) {
					var row = parent.find('.grid-row[data-id=' + _voicemailId + ']');

					monster.ui.highlight(row, {
						endColor: '#FCFCFC'
					});
				}

				if (dataTemplate.vmboxes.length === 0) {
					parent.find('.no-vmboxes-row').css('display', 'block');
				} else {
					parent.find('.no-vmboxes-row').css('display', 'none');
				}

				callback && callback();
			});
		},

		vmboxesBindEvents: function(template, parent, data) {
			var self = this,
				callbackSave = function(vmbox) {
					self.vmboxesRender({ voicemailId: vmbox.id });
				};

			setTimeout(function() { template.find('.search-query').focus(); });

			template.find('.settings').on('click', function() {
				self.vmboxesRenderEdit($(this).parents('.grid-row').data('id'), callbackSave);
			});

			template.find('.add-vmbox').on('click', function() {
				self.vmboxesRenderEdit(undefined, callbackSave);
			});

			template.find('.vmboxes-header .search-query').on('keyup', function() {
				var searchString = $(this).val().toLowerCase(),
					rows = template.find('.vmboxes-rows .grid-row:not(.title)'),
					emptySearch = template.find('.vmboxes-rows .empty-search-row');

				_.each(rows, function(row) {
					var row = $(row);

					row.data('search').toLowerCase().indexOf(searchString) < 0 ? row.hide() : row.show();
				});

				if (rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});
		},

		vmboxesRenderEdit: function(id, callback) {
			var self = this;

			self.vmboxesGetEditData(id, function(data) {
				data = self.vmboxesMigrateData(data);

				self.vmboxesRenderVmbox(data, callback);
			});
		},

		vmboxesMigrateData: function(data) {
			var self = this;

			if (data.hasOwnProperty('notify_email_address')) {
				data.notify_email_addresses = data.notify_email_address;
			}

			return data;
		},

		vmboxesRenderVmbox: function(data, callback) {
			var self = this,
				mode = data.id ? 'edit' : 'add',
				popupTitle = mode === 'edit'
					? self.getTemplate({
						name: '!' + self.i18n.active().vmboxes.editTitle,
						data: {
							name: data.name
						}
					})
					: self.i18n.active().vmboxes.addTitle,
				templateVMBox = $(self.getTemplate({
					name: 'edit',
					data: data,
					submodule: 'vmboxes'
				})),
				popup,
				callbacks = {
					afterSave: function(vmbox) {
						popup.dialog('close').remove();

						callback && callback(vmbox);
					},
					afterDelete: function() {
						popup.dialog('close').remove();

						self.vmboxesRender();
					},
					afterCancel: function() {
						popup.dialog('close').remove();
					}
				};

			_.each(data.notify_email_addresses, function(recipient) {
				templateVMBox
					.find('.saved-entities')
						.append($(self.getTemplate({
							name: 'emailRow',
							data: {
								name: recipient
							},
							submodule: 'vmboxes'
						})));
			});

			monster.pub('common.mediaSelect.render', {
				container: templateVMBox.find('.greeting-container'),
				name: 'media.unavailable',
				options: data.extra.mediaList,
				selectedOption: (data.media || {}).unavailable,
				label: self.i18n.active().vmboxes.popupSettings.greeting.dropdownLabel,
				callback: function(greeting) {
					monster.pub('common.mediaSelect.render', {
						container: templateVMBox.find('.temporary-greeting-container'),
						name: 'media.temporary_unavailable',
						options: data.extra.mediaList,
						selectedOption: (data.media || {}).temporary_unavailable,
						label: self.i18n.active().vmboxes.popupSettings.greeting.temporary.label,
						callback: function(temporaryGreeting) {
							self.vmboxesEditBindEvents(templateVMBox, data, greeting, temporaryGreeting, callbacks);

							popup = monster.ui.dialog(templateVMBox, {
								position: ['center', 20],
								title: popupTitle,
								width: '700'
							});
						}
					});
				}
			});
		},

		vmboxesEditBindEvents: function(templateVMBox, data, greetingControl, temporaryGreetingControl, callbacks) {
			var self = this,
				vmboxForm = templateVMBox.find('#form_vmbox');

			monster.ui.validate(vmboxForm, {
				rules: {
					'name': {
						required: true
					}
				}
			});

			monster.ui.tabs(templateVMBox);

			timezone.populateDropdown(templateVMBox.find('#timezone'), data.timezone || 'inherit', {inherit: self.i18n.active().defaultTimezone});
			monster.ui.chosen(templateVMBox.find('#timezone'));

			monster.ui.tooltips(templateVMBox);

			templateVMBox.find('.actions .save').on('click', function() {
				if (monster.ui.valid(vmboxForm)) {
					var dataToSave = self.vmboxesMergeData(data, templateVMBox, greetingControl, temporaryGreetingControl);

					self.vmboxesSaveVmbox(dataToSave, function(data) {
						callbacks.afterSave && callbacks.afterSave(data);
					});
				} else {
					templateVMBox.find('.tabs-selector[data-section="basic"]').click();
				}
			});

			templateVMBox.find('#delete_vmbox').on('click', function() {
				var voicemailId = $(this).parents('.edit-vmbox').data('id');

				monster.ui.confirm(self.i18n.active().vmboxes.confirmDeleteVmbox, function() {
					self.vmboxesDeleteVmbox(voicemailId, function(vmbox) {
						toastr.succes(self.getTemplate({
							name: '!' + self.i18n.active().vmboxes.deletedVmbox,
							data: {
								vmboxName: vmbox.name
							}
						}));

						callbacks.afterDelete && callbacks.afterDelete(vmbox);
					});
				});
			});

			templateVMBox.find('.actions .cancel-link').on('click', function() {
				callbacks.afterCancel && callbacks.afterCancel();
			});

			// Recipients stuff
			var addEntity = function(event) {
				event.preventDefault();

				var inputName = templateVMBox.find('#entity_name'),
					name = inputName.val(),
					templateFlag = $(self.getTemplate({
						name: 'emailRow',
						data: {
							name: name
						},
						submodule: 'vmboxes'
					}));

				templateVMBox.find('.saved-entities').prepend(templateFlag);

				inputName
					.val('')
					.focus();
			};

			templateVMBox.find('.entity-wrapper.placeholder:not(.active)').on('click', function() {
				$(this).addClass('active');
				templateVMBox.find('#entity_name').focus();
			});

			templateVMBox.find('#cancel_entity').on('click', function(e) {
				e.stopPropagation();

				$(this).siblings('input').val('');

				templateVMBox.find('.entity-wrapper.placeholder')
						.removeClass('active');
			});

			templateVMBox.find('#add_entity').on('click', function(e) {
				addEntity(e);
			});

			templateVMBox.find('#entity_name').on('keypress', function(e) {
				var code = e.keyCode || e.which;

				if (code === 13) {
					addEntity(e);
				}
			});

			templateVMBox.find('.saved-entities').on('click', '.delete-entity', function() {
				$(this).parents('.entity-wrapper').remove();
			});
		},

		vmboxesMergeData: function(originalData, template, greetingControl, temporaryGreetingControl) {
			var self = this,
				formData = monster.ui.getFormData('form_vmbox'),
				mergedData = $.extend(true, {}, originalData, formData);

			// Rebuild list of recipients from UI
			mergedData.notify_email_addresses = [];
			template.find('.saved-entities .entity-wrapper').each(function() {
				mergedData.notify_email_addresses.push($(this).data('name'));
			});

			mergedData.not_configurable = !formData.extra.configurable;

			if (mergedData.pin === '') {
				delete mergedData.pin;
			}

			// Delete data that is obsolete (migrated to notify_email_addresses)
			if (mergedData.hasOwnProperty('notify_email_address')) {
				delete mergedData.notify_email_address;
			}

			if (mergedData.timezone && mergedData.timezone === 'inherit') {
				delete mergedData.timezone;
			}

			mergedData.media.unavailable = greetingControl.getValue();
			if (mergedData.media && mergedData.media.unavailable === 'none') {
				delete mergedData.media.unavailable;
			}

			mergedData.media.temporary_unavailable = temporaryGreetingControl.getValue();
			if (mergedData.media && mergedData.media.temporary_unavailable === 'none') {
				delete mergedData.media.temporary_unavailable;
			}

			if (mergedData.media_extension && mergedData.media_extension === 'default') {
				delete mergedData.media_extension;
			}

			delete mergedData.extra;

			return mergedData;
		},

		vmboxesFormatData: function(data) {
			var self = this,
				defaults = {
					require_pin: true,
					check_if_owner: true
				},
				formattedData = $.extend(true, {}, defaults, data.vmbox);

			formattedData.extra = {
				mediaList: data.mediaList
			};

			return formattedData;
		},

		vmboxesFormatListData: function(results) {
			var self = this,
				formattedData = {
					countVMBoxes: results.vmboxes.length,
					vmboxes: results.vmboxes
				},
				mapUsers = {};

			_.each(results.users, function(user) {
				mapUsers[user.id] = user;
			});

			formattedData.vmboxes.sort(function(a, b) {
				return parseInt(a.mailbox) > parseInt(b.mailbox) ? 1 : -1;
			});

			_.each(formattedData.vmboxes, function(vmbox) {
				if (vmbox.hasOwnProperty('owner_id') && mapUsers.hasOwnProperty(vmbox.owner_id)) {
					vmbox.friendlyOwnerName = mapUsers[vmbox.owner_id].first_name + ' ' + mapUsers[vmbox.owner_id].last_name;
				} else {
					vmbox.friendlyOwnerName = '-';
				}
			});

			return formattedData;
		},

		/* Utils */
		vmboxesDeleteVmbox: function(voicemailId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.delete',
				data: {
					accountId: self.accountId,
					voicemailId: voicemailId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		vmboxesGetEditData: function(id, callback) {
			var self = this;

			monster.parallel({
				vmbox: function(callback) {
					if (id) {
						self.vmboxesGetVmbox(id, function(dataVmbox) {
							callback(null, dataVmbox);
						});
					} else {
						callback(null, {});
					}
				},
				mediaList: function(callback) {
					self.callApi({
						resource: 'media.list',
						data: {
							accountId: self.accountId
						},
						success: function(data) {
							callback(null, data.data);
						}
					});
				}
			}, function(error, results) {
				var formattedData = self.vmboxesFormatData(results);

				callback && callback(formattedData);
			});
		},

		vmboxesGetVmbox: function(voicemailId, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'voicemail.get',
				data: {
					accountId: self.accountId,
					voicemailId: voicemailId
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		vmboxesSaveVmbox: function(vmboxData, callback) {
			var self = this;

			if (vmboxData.id) {
				self.vmboxesUpdateVmbox(vmboxData, callback);
			} else {
				self.vmboxesCreateVmbox(vmboxData, callback);
			}
		},

		vmboxesCreateVmbox: function(vmboxData, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					data: vmboxData
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		vmboxesUpdateVmbox: function(vmboxData, callbackSuccess, callbackError) {
			var self = this;

			self.callApi({
				resource: 'voicemail.update',
				data: {
					accountId: self.accountId,
					data: vmboxData,
					voicemailId: vmboxData.id
				},
				success: function(data) {
					callbackSuccess && callbackSuccess(data.data);
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		vmboxesGetData: function(callback) {
			var self = this;

			monster.parallel({
				users: function(callback) {
					self.callApi({
						resource: 'user.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(dataUsers) {
							callback && callback(null, dataUsers.data);
						}
					});
				},
				vmboxes: function(callback) {
					self.callApi({
						resource: 'voicemail.list',
						data: {
							accountId: self.accountId,
							filters: {
								paginate: 'false'
							}
						},
						success: function(datavmboxes) {
							callback(null, datavmboxes.data);
						}
					});
				}
			}, function(err, results) {
				self.vmboxesFormatListData(results);

				callback && callback(results);
			});
		}
	};

	return app;
});
