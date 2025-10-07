define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		timezone = require('monster-timezone');

	var app = {

		requests: {},

		subscribe: {
			'voip.vmboxes.render': 'vmboxesRender',
			'voip.vmboxes.removeCallflowModule': 'vmboxesRemoveCallflowModule'
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

			return _.merge({}, data, _.has(data, 'notify_email_address') && {
				notify_email_addresses: data.notify_email_address
			});
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
				transcription = monster.util.getCapability('voicemail.transcription'),
				templateVMBox = $(self.getTemplate({
					name: 'edit',
					data: _.merge(data, {
						hasTranscribe: _.get(transcription, 'isEnabled', false),
						transcribe: _.get(data, 'transcribe', transcription.defaultValue),
						announcement_only: _.get(data, 'announcement_only', false),
						include_message_on_notify: _.get(data, 'include_message_on_notify', true)
					}),
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

			self.vmboxesRenderMembers({
				template: templateVMBox,
				members: data.members,
				loadNames: true
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
				vmboxForm = templateVMBox.find('#form_vmbox'),
				shareCheckbox = vmboxForm.find('#shared_vmbox'),
				vmboxEditMembers = vmboxForm.find('.edit-members'),
				userMembers = _.chain(data)
					.get('members', [])
					.filter({ type: 'user' })
					.value(),
				showMemberSelector = function showMemberSelector(uncheckShareOnCancel) {
					var selectedUserIds = _.map(userMembers, 'id');

					monster.pub('common.userSelector.renderDialog', {
						title: _.get(self.i18n.active().callflows, 'vmbox.sharedMembersSelector.title'),
						selectedUserIds: selectedUserIds,
						i18n: {
							okButton: _.get(self.i18n.active().callflows, 'vmbox.sharedMembersSelector.okButton'),
							columnsTitles: {
								available: _.get(self.i18n.active().callflows, 'vmbox.sharedMembersSelector.available'),
								selected: _.get(self.i18n.active().callflows, 'vmbox.sharedMembersSelector.selected')
							}
						},
						okCallback: function(selectedUsers) {
							userMembers = _.map(selectedUsers, function(user) {
								return {
									id: user.key,
									type: 'user',
									name: user.value
								};
							});

							self.vmboxesRenderMembers({
								template: vmboxForm,
								members: userMembers,
								loadNames: false
							});

							vmboxEditMembers.removeClass('hidden');
						},
						cancelCallback: function() {
							if (uncheckShareOnCancel) {
								shareCheckbox.prop('checked', false);
							}
						}
					});
				};

			monster.ui.validate(vmboxForm, {
				rules: {
					'name': {
						required: true
					}
				}
			});

			monster.ui.tabs(templateVMBox);

			timezone.populateDropdown(templateVMBox.find('#timezone'), data.timezone || 'inherit', { inherit: self.i18n.active().defaultTimezone });
			monster.ui.chosen(templateVMBox.find('#timezone'));

			monster.ui.tooltips(templateVMBox);

			templateVMBox.find('.actions .save').on('click', function() {
				if (monster.ui.valid(vmboxForm)) {
					var dataToSave = self.vmboxesMergeData(data, templateVMBox, greetingControl, temporaryGreetingControl, userMembers),
						$skipInstructionsInput = templateVMBox.find('#skip_instructions_input').val();

					if (dataToSave.announcement_only) {
						dataToSave.skip_instructions = $skipInstructionsInput === 'true' ? true : false;
					} else {
						delete dataToSave.announcement_only;
					}

					self.vmboxesSaveVmbox(dataToSave, function(data) {
						callbacks.afterSave && callbacks.afterSave(data);
					});
				} else {
					templateVMBox.find('.tabs-selector[data-section="basic"]').click();
				}
			});

			templateVMBox.find('#skip_instructions').on('click', function() {
				var isChecked = $(this).prop('checked');

				templateVMBox.find('#skip_instructions_input').val(isChecked);
			});

			templateVMBox.find('#announcement_only').on('click', function() {
				var $this = $(this),
					isChecked = $this.prop('checked'),
					$skipInstructions = templateVMBox.find('#skip_instructions'),
					$parentDiv = $skipInstructions.parents('label.control-input'),
					$skipInstructionsInput = templateVMBox.find('#skip_instructions_input').val(),
					isSkipInstructions = $skipInstructionsInput === 'true' ? true : false,
					isDisabled = false;

				if (isChecked) {
					isDisabled = true;
					isSkipInstructions = true;

					$parentDiv
						.addClass('disabled');
				} else {
					$parentDiv
						.removeClass('disabled');
				}

				$skipInstructions
					.prop('checked', isSkipInstructions);

				$skipInstructions
					.prop('disabled', isDisabled);
			});

			templateVMBox.find('#delete_vmbox').on('click', function() {
				var voicemailId = $(this).parents('.edit-vmbox').data('id');

				monster.ui.confirm(self.i18n.active().vmboxes.confirmDeleteVmbox, function() {
					self.vmboxesDeleteVmbox({
						voicemailId: voicemailId,
						success: function(vmbox) {
							monster.ui.toast({
								type: 'success',
								message: self.getTemplate({
									name: '!' + self.i18n.active().vmboxes.deletedVmbox,
									data: {
										vmboxName: vmbox.name
									}
								})
							});

							callbacks.afterDelete && callbacks.afterDelete(vmbox);
						}
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

			// Shared vmbox members
			$('#shared_vmbox', vmboxForm).on('change', function(ev) {
				if (this.checked) {
					showMemberSelector(true);
					return;
				}

				userMembers = [];

				vmboxEditMembers.addClass('hidden');

				self.vmboxesRenderMembers({
					template: vmboxForm,
					members: userMembers,
					loadNames: false
				});
			});

			$('.edit-members', vmboxForm).on('click', function() {
				showMemberSelector(false);
			});
		},

		/**
		 * Renders the list of vmbox members.
		 * @param  {Object}   args
		 * @param  {jQuery}   args.template         Vmbox edit template.
		 * @param  {Object[]} args.members          Vmbox member list.
		 * @param  {String}   args.members[].id     Member's user ID.
		 * @param  {'user'|'group'} args.members[].type Member's type
		 * @param  {String}   [args.members[].name] Member's name.
		 * @param  {Boolean}  args.loadNames        Whether to load or not the member names from the backend.
		 */
		vmboxesRenderMembers: function(args) {
			var self = this,
				$template = args.template,
				$membersContainer = $template.find('.vmbox-members'),
				members = args.members,
				loadNames = !!args.loadNames;

			// Empty the members container
			$membersContainer.empty();

			// If there are no members, do nothing
			if (_.isEmpty(members)) {
				return;
			}

			// Else, load the member names if necessary, and render the list
			monster.waterfall([
				function loadUsers(next) {
					if (!loadNames) {
						return next(null, null);
					}

					return self.vmboxesGetUserList(next);
				},
				function addUserNames(users, next) {
					if (!loadNames) {
						return next(null, members);
					}

					var usersById = _.keyBy(users, 'id'),
						updatedMembers = _.chain(members)
							.filter({ type: 'user' })
							.map(function(member) {
								var user = _.get(usersById, member.id),
									name = user
										? monster.util.getUserFullName(user)
										: null;

								return _.assign({
									name: name
								}, member);
							})
							.filter()
							.value();

					return next(null, updatedMembers);
				}
			], function(err, membersWithNames) {
				if (err) {
					return;
				}

				var $memberListTemplate = $(self.getTemplate({
					name: 'members',
					data: {
						members: membersWithNames
					},
					submodule: 'vmboxes'
				}));

				$membersContainer
					.append($memberListTemplate);
			});
		},

		vmboxesMergeData: function(originalData, template, greetingControl, temporaryGreetingControl, userMembers) {
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

			if (mergedData.shared_vmbox) {
				mergedData.members = _.map(userMembers, function(userMember) {
					return _.pick(userMember, ['id', 'type']);
				});
			} else if (_.has(mergedData, 'members')) {
				delete mergedData.members;
			}

			delete mergedData.extra;

			return mergedData;
		},

		vmboxesFormatData: function(data) {
			var self = this;

			return _.merge({
				require_pin: true,
				check_if_owner: true
			}, data.vmbox, {
				extra: _.pick(data, [
					'mediaList'
				])
			});
		},

		vmboxesFormatListData: function(results) {
			var mapUsers = _.keyBy(results.users, 'id');

			return {
				countVMBoxes: _.size(results.vmboxes),
				vmboxes: _
					.chain(results.vmboxes)
					.map(function(vmbox) {
						return _.merge({
							friendlyOwnerName: _
								.chain(mapUsers)
								.get(_.get(vmbox, 'owner_id'), {
									first_name: '-',
									last_name: ''
								})
								.thru(monster.util.getUserFullName)
								.value()
						}, vmbox);
					})
					.sortBy(_.flow([
						_.partial(_.get, _, 'mailbox'),
						_.parseInt
					]))
					.value()
			};
		},

		/* Utils */
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

		vmboxesGetUserList: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: false
					}
				},
				success: function(data) {
					callback && callback(null, data.data);
				},
				error: function(parsedError) {
					callback && callback(parsedError);
				}
			});
		},

		vmboxesGetData: function(callback) {
			var self = this;

			monster.parallel({
				users: _.bind(self.vmboxesGetUserList, self),
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
		},

		/**
		 * Deletes a user voicemail box
		 * @param  {Object}   args
		 * @param  {Object}   args.voicemailId  ID of the voicemail box to delete
		 * @param  {Function} [args.success]    Success callback
		 * @param  {Function} [args.error]      Error callback
		 */
		vmboxesDeleteVmbox: function(args) {
			var self = this,
				voicemailId = args.voicemailId;

			monster.waterfall([
				function(callback) {
					self.vmboxesRequestDeleteVmbox({
						data: {
							voicemailId: voicemailId
						},
						success: function(deletedVmbox) {
							callback(null, deletedVmbox);
						},
						error: function() {
							callback(true);
						}
					});
				},
				function(vmbox, callback) {
					self.vmboxesGetUserMainCallflow({
						userId: vmbox.owner_id,
						success: function(userMainCallflow) {
							callback(null, vmbox, userMainCallflow);
						},
						error: function() {
							callback(true);
						}
					});
				},
				function(vmbox, userMainCallflow, callback) {
					if (_.isUndefined(userMainCallflow)) {
						callback(null, vmbox);
						return;
					}
					self.vmboxesRemoveCallflowModule({
						callflow: userMainCallflow,
						module: 'voicemail',
						dataId: voicemailId,
						success: function() {
							callback(null, vmbox);
						},
						error: function() {
							callback(true);
						}
					});
				}
			], function(err, vmbox) {
				if (err) {
					_.has(args, 'error') && args.error(err);
				} else {
					_.has(args, 'success') && args.success(vmbox);
				}
			});
		},

		/**
		 * Deletes a user voicemail box
		 * @param  {Object}   args
		 * @param  {Object}   args.callflow   Callflow to modify
		 * @param  {String}   args.module     Module type to remove
		 * @param  {String}   args.dataId     ID of the data whose module should be removed
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		vmboxesRemoveCallflowModule: function(args) {
			var self = this,
				callflow = args.callflow,
				parentFlow = callflow,
				flow = _.get(parentFlow, 'flow'),
				cfModule = args.module,
				dataId = args.dataId,
				callflowModified = false;

			monster.series([
				function(callback) {
					while (flow) {
						if (flow.module === cfModule && _.get(flow, 'data.id') === dataId) {
							var childFlow = _.get(flow, 'children._', {});
							if (_.has(parentFlow, 'flow')) {
								// The parent is the callflow itself
								parentFlow.flow = childFlow;
								flow = parentFlow.flow;
							} else if (_.isEmpty(childFlow)) {
								parentFlow.children = {};
								flow = null;
							} else {
								parentFlow.children._ = childFlow;
								flow = childFlow;
							}
							callflowModified = true;
						}

						parentFlow = flow;
						flow = _.get(flow, 'children._');
					}

					callback(null);
				},
				function(callback) {
					if (!callflowModified) {
						callback(null);
						return;
					}

					self.usersRequestUpdateCallflow({
						callflow: callflow,
						success: function() {
							callback(null);
						},
						error: function() {
							callback(true);
						}
					});
				}
			], function(err) {
				if (err) {
					_.has(args, 'error') && args.error();
				} else {
					_.has(args, 'success') && args.success();
				}
			});
		},

		/**
		 * Gets the main callflow for a user, by its user ID
		 * @param  {Object}   args
		 * @param  {String}   args.userId   User ID
		 * @param  {Function} args.success  Success callback
		 * @param  {Function} [args.error]  Error callback
		 */
		vmboxesGetUserMainCallflow: function(args) {
			var self = this,
				userId = args.userId;

			monster.waterfall([
				function(callback) {
					self.vmboxesRequestListCallflows({
						data: {
							filters: {
								filter_owner_id: userId,
								filter_type: 'mainUserCallflow',
								paginate: 'false'
							}
						},
						success: function(callflowsData) {
							callback(null, callflowsData);
						},
						error: function() {
							callback(true);
						}
					});
				},
				function(callflowsData, callback) {
					if (_.isEmpty(callflowsData)) {
						callback(null);
						return;
					}

					self.vmboxesRequestGetCallflow({
						data: {
							callflowId: _.head(callflowsData).id
						},
						success: function(data) {
							callback(null, data);
						},
						error: function() {
							callback(true);
						}
					});
				}
			], function(err, userMainCallflow) {
				if (err) {
					_.has(args, 'error') && args.error(err);
				} else {
					_.has(args, 'success') && args.success(userMainCallflow);
				}
			});
		},

		/**
		 * Request a list of callflows to te API
		 * @param  {Object}   args
		 * @param  {Object}   [args.data]
		 * @param  {Object}   [args.data.filters]  Querystring filters
		 * @param  {Function} [args.success]       Success callback
		 * @param  {Function} [args.error]         Error callback
		 */
		vmboxesRequestListCallflows: function(args) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Request a callflow to the API by ID
		 * @param  {Object}   args
		 * @param  {Object}   args.data
		 * @param  {String}   args.data.callflowId  Callflow ID
		 * @param  {Function} [args.success]        Success callback
		 * @param  {Function} [args.error]          Error callback
		 */
		vmboxesRequestGetCallflow: function(args) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: _.merge({
					accountId: self.accountId
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		},

		/**
		 * Request a callflow to the API by ID
		 * @param  {Object}   args
		 * @param  {Object}   args.callflow   Callflow to update
		 * @param  {Function} [args.success]  Success callback
		 * @param  {Function} [args.error]    Error callback
		 */
		usersRequestUpdateCallflow: function(args) {
			var self = this,
				callflow = args.callflow;

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflow.id,
					data: callflow
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
		 * Request the deletion of a voicemail box to the API, by its ID
		 * @param  {Object}   args
		 * @param  {Object}   args.data
		 * @param  {String}   args.data.voicemailId  Voicemail box ID
		 * @param  {Function} [args.success]         Success callback
		 * @param  {Function} [args.error]           Error callback
		 */
		vmboxesRequestDeleteVmbox: function(args) {
			var self = this;

			self.callApi({
				resource: 'voicemail.delete',
				data: _.merge({
					accountId: self.accountId,
					data: {}
				}, args.data),
				success: function(data) {
					_.has(args, 'success') && args.success(data.data);
				},
				error: function(parsedError) {
					_.has(args, 'error') && args.error(parsedError);
				}
			});
		}
	};

	return app;
});
