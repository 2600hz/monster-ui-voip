define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		chosen = require('chosen'),
		monster = require('monster'),
		timezone = require('monster-timezone'),
		toastr = require('toastr');

	var app = {

		requests: {},

		subscribe: {
			'voip.users.render': 'usersRender'
		},

		deviceIcons: {
			'cellphone': 'fa fa-phone',
			'smartphone': 'icon-telicon-mobile-phone',
			'landline': 'icon-telicon-home',
			'mobile': 'icon-telicon-sprint-phone',
			'softphone': 'icon-telicon-soft-phone',
			'sip_device': 'icon-telicon-voip-phone',
			'sip_uri': 'icon-telicon-voip-phone',
			'fax': 'icon-telicon-fax',
			'ata': 'icon-telicon-fax'
		},

		/* Users */
		/* args: parent and userId */
		usersRender: function(args) {
			var self = this,
				args = args || {},
				parent = args.parent || $('.right-content'),
				_userId = args.userId,
				_openedTab = args.openedTab,
				callback = args.callback;

			self.usersRemoveOverlay();

			self.usersGetData(function(data) {
				var dataTemplate = self.usersFormatListData(data),
					template = $(monster.template(self, 'users-layout', dataTemplate)),
					templateUser;

				_.each(dataTemplate.users, function(user) {
					templateUser = monster.template(self, 'users-row', user);

					template.find('.user-rows').append(templateUser);
				});

				monster.ui.tooltips(template, {
					options: {
						container: 'body'
					}
				});
				template.find('[data-toggle="popover"]').popover({ container: 'body'});

				self.usersBindEvents(template, parent, dataTemplate);

				parent
					.empty()
					.append(template);

				self.usersCheckWalkthrough();

				if(_userId) {
					var cells = parent.find('.grid-row[data-id=' + _userId + '] .grid-cell');

					monster.ui.highlight(cells);
				}

				if ( dataTemplate.users.length === 0) {
					parent.find('.grid-row.title').css('display', 'none');
					parent.find('.no-users-row').css('display', 'block');
				} else {
					parent.find('.grid-row.title').css('display', 'block');
					parent.find('.no-users-row').css('display', 'none');
				}

				if(_userId && _openedTab) {
					template.find('.grid-row[data-id="'+ _userId +'"] .grid-cell[data-type="' + _openedTab + '"]').click();
				}

				callback && callback();
			});
		},

		usersCheckWalkthrough: function() {
			var self = this;

			self.usersHasWalkthrough(function() {
				self.usersShowWalkthrough(function() {
					self.usersUpdateWalkthroughFlagUser();
				});
			});
		},

		usersHasWalkthrough: function(callback) {
			var self = this,
				flag = self.uiFlags.user.get('showUsersWalkthrough');

			if(flag !== false) {
				callback && callback();
			}
		},

		usersUpdateWalkthroughFlagUser: function(callback) {
			var self = this,
				userToSave = self.uiFlags.user.set('showUsersWalkthrough', false);

			self.usersUpdateOriginalUser(userToSave, function(user) {
				callback && callback(user);
			});
		},

		usersShowWalkthrough: function(callback) {
			var self = this,
				mainTemplate = $('#voip_container'),
				rowFirstUser = mainTemplate.find('.grid-row:not(.title):first'),
				steps =  [
					{
						element: mainTemplate.find('.add-user')[0],
						intro: self.i18n.active().users.walkthrough.steps['1'],
						position: 'right'
					},
					{
						element: rowFirstUser.find('.name')[0],
						intro: self.i18n.active().users.walkthrough.steps['2'],
						position: 'right'
					},
					{
						element: rowFirstUser.find('.extension')[0],
						intro: self.i18n.active().users.walkthrough.steps['3'],
						position: 'bottom'
					},
					{
						element: rowFirstUser.find('.phone-number')[0],
						intro: self.i18n.active().users.walkthrough.steps['4'],
						position: 'bottom'
					},
					{
						element: rowFirstUser.find('.devices')[0],
						intro: self.i18n.active().users.walkthrough.steps['5'],
						position: 'left'
					},
					{
						element: rowFirstUser.find('.features')[0],
						intro: self.i18n.active().users.walkthrough.steps['6'],
						position: 'left'
					}
				];

			monster.ui.stepByStep(steps, function() {
				callback && callback();
			});
		},

		usersFormatUserData: function(dataUser, _mainDirectory, _mainCallflow, _vmbox, _vmboxes) {
			var self = this,
				formattedUser = {
					additionalDevices: 0,
					additionalExtensions: 0,
					additionalNumbers: 0,
					devices: [],
					extension: dataUser.hasOwnProperty('presence_id') ? dataUser.presence_id : '',
					hasFeatures: false,
					isAdmin: dataUser.priv_level === 'admin',
					listCallerId: [],
					listExtensions: [],
					listNumbers: [],
					phoneNumber: '',
					differentEmail: dataUser.email !== dataUser.username,
					mapFeatures: {
						caller_id: {
							icon: 'fa fa-user',
							iconColor: 'monster-blue',
							title: self.i18n.active().users.caller_id.title
						},
						call_forward_failover: {
							icon: 'fa fa-share',
							iconColor: 'monster-orange',
							title: self.i18n.active().users.call_forward.failover_title,
							hidden: true
						},
						call_forward: {
							icon: 'fa fa-share',
							iconColor: 'monster-yellow',
							title: self.i18n.active().users.call_forward.title
						},
						hotdesk: {
							icon: 'fa fa-fire',
							iconColor: 'monster-orange',
							title: self.i18n.active().users.hotdesk.title
						},
						vm_to_email: {
							icon: 'icon-telicon-voicemail',
							iconColor: 'monster-green',
							title: self.i18n.active().users.vm_to_email.title
						},
						faxing: {
							icon: 'icon-telicon-fax',
							iconColor: 'monster-red',
							title: self.i18n.active().users.faxing.title
						},
						conferencing: {
							icon: 'fa fa-comments',
							iconColor: 'monster-grey',
							title: self.i18n.active().users.conferencing.title
						},
						find_me_follow_me: {
							icon: 'fa fa-sitemap',
							iconColor: 'monster-purple',
							title: self.i18n.active().users.find_me_follow_me.title
						},
						music_on_hold: {
							icon: 'fa fa-music',
							iconColor: 'monster-pink',
							title: self.i18n.active().users.music_on_hold.title
						},
						call_recording: {
							icon: 'fa fa-microphone',
							iconColor: 'monster-blue',
							title: self.i18n.active().users.callRecording.title
						}
					}
				};

			if(!('extra' in dataUser)) {
				dataUser.extra = formattedUser;
			}

			dataUser.extra.countFeatures = 0;
			_.each(dataUser.features, function(v) {
				if(v in dataUser.extra.mapFeatures) {
					dataUser.extra.countFeatures++;
					dataUser.extra.mapFeatures[v].active = true;
				}
			});

			if(dataUser.extra.countFeatures > 0) {
				dataUser.extra.hasFeatures = true;
			}

			if(_mainDirectory) {
				dataUser.extra.mainDirectoryId = _mainDirectory.id;

				if('directories' in dataUser && _mainDirectory.id in dataUser.directories) {
					dataUser.extra.includeInDirectory = true;
				}
				else {
					dataUser.extra.includeInDirectory = false;
				}
			}

			if(_mainCallflow) {
				dataUser.extra.mainCallflowId = _mainCallflow.id;

				if('flow' in _mainCallflow) {
					var flow = _mainCallflow.flow,
						module = 'user';

					if(dataUser.features.indexOf('find_me_follow_me') >= 0) {
						module = 'ring_group';
						dataUser.extra.groupTimeout = true;
					}

					while(flow.module != module && '_' in flow.children) {
						flow = flow.children['_'];
					}
					dataUser.extra.ringingTimeout = flow.data.timeout;
				}
			}

			if(_vmbox) {
				dataUser.extra.vmbox = _vmbox;
			}

			if(!_.isEmpty(_vmbox) && !_.isEmpty(_vmboxes)) {
				var i = _vmboxes.indexOf(_vmbox.mailbox);

				_vmboxes.splice(i, 1);

				dataUser.extra.existingVmboxes = _vmboxes;
			}

			dataUser.extra.adminId = self.userId;

			dataUser.extra.presenceIdOptions = [];

			var temp,
				hasValidPresenceID = false,
				addNumberToPresenceOptions = function(number) {
					temp = {
						key: number,
						value: monster.util.formatPhoneNumber(number)
					};

					dataUser.extra.presenceIdOptions.push(temp);
				};

			_.each(dataUser.extra.listExtensions, function(extension) {
				if(dataUser.hasOwnProperty('presence_id') && dataUser.presence_id === extension) {
					hasValidPresenceID = true;
				}

				addNumberToPresenceOptions(extension);
			});

			// Sort it from lower number to greater number
			dataUser.extra.presenceIdOptions.sort(function(a,b) {
				return a.key > b.key ? 1 : -1;
			});

			// If they don't have a valid Presence ID, then we add the "Unset" option
			if(!hasValidPresenceID) {
				dataUser.extra.presenceIdOptions.unshift({ key: 'unset', value: self.i18n.active().users.editionForm.noPresenceID });
			}

			return dataUser;
		},

		usersFormatListData: function(data) {
			var self = this,
				dataTemplate = {
					existingExtensions: [],
					countUsers: data.users.length
				},
				mapUsers = {};

			_.each(data.users, function(user) {
				mapUsers[user.id] = self.usersFormatUserData(user);
			});

			_.each(data.callflows, function(callflow) {
				if(callflow.type !== 'faxing') {
					var userId = callflow.owner_id;

					_.each(callflow.numbers, function(number) {
						if(number && number.length < 7) {
							dataTemplate.existingExtensions.push(number);
						}
					});

					if(userId in mapUsers) {
						var user = mapUsers[userId];

						//User can only have one phoneNumber and one extension displayed with this code
						_.each(callflow.numbers, function(number) {
							if(number.length < 7) {
								user.extra.listExtensions.push(number);
							}
							else {
								user.extra.listCallerId.push(number);

								user.extra.listNumbers.push(number);

								if(user.extra.phoneNumber === '') {
									user.extra.phoneNumber = number;
								}
								else {
									user.extra.additionalNumbers++;
								}
							}
						});

						// The additional extensions show how many more extensions than 1 a user has. 
						// So if the user has at least 1 extension, then we count how many he has minus the one we already display, otherwise we display 0.
						user.extra.additionalExtensions = user.extra.listExtensions.length >= 1 ? user.extra.listExtensions.length - 1 : 0;

						// If the main extension hasn't been defined because the presence_id isn't set, just pick the first extension
						if(user.extra.extension === '' && user.extra.listExtensions.length > 0) {
							user.extra.extension = user.extra.listExtensions[0];
						}
					}
				}
			});

			dataTemplate.existingExtensions.sort(self.usersSortExtensions);

			_.each(data.devices, function(device) {
				var userId = device.owner_id;

				if(userId in mapUsers) {
					var isRegistered = _.find(data.deviceStatus, function(status){ return (status.device_id === device.id && status.registered === true); }) ? true : false;

					if(mapUsers[userId].extra.devices.length >= 2) {
						if(mapUsers[userId].extra.additionalDevices === 0) {
							mapUsers[userId].extra.additionalDevices = {
								count: 0,
								tooltip: ''
							};
						}

						mapUsers[userId].extra.additionalDevices.count++;
						mapUsers[userId].extra.additionalDevices.tooltip += '<i class=\"device-popover-icon '+self.deviceIcons[device.device_type]+(isRegistered?' monster-green':' monster-red')+'\"></i>'
							                                                 + device.name + ' (' + device.device_type.replace('_', ' ') + ')<br>';
					}

					var deviceDataToTemplate = {
							id: device.id,
							name: device.name + ' (' + device.device_type.replace('_', ' ') + ')',
							type: device.device_type,
							registered: isRegistered,
							icon: self.deviceIcons[device.device_type]
						};

					if (device.device_type === 'mobile') {
						deviceDataToTemplate.mobile = device.mobile;
					}

					mapUsers[userId].extra.devices.push(deviceDataToTemplate);
				}
			});

			var sortedUsers = [];

			_.each(mapUsers, function(user) {
				sortedUsers.push(user);
			});

			dataTemplate.users = sortedUsers;

			return dataTemplate;
		},

		usersDeleteDialog: function(user, callback) {
			var self = this,
				dataTemplate = {
					user: user
				},
				dialogTemplate = $(monster.template(self, 'users-deleteDialog', dataTemplate));

			monster.ui.tooltips(dialogTemplate);

			dialogTemplate.find('#confirm_button').on('click', function() {
				var removeDevices = dialogTemplate.find('#delete_devices').is(':checked'),
					removeConferences = dialogTemplate.find('#delete_conferences').is(':checked');

				self.usersDelete(user.id, removeDevices, removeConferences, function(data) {
					popup.dialog('close').remove();

					callback && callback(data);
				});
			});

			dialogTemplate.find('#cancel_button').on('click', function() {
				popup.dialog('close').remove();
			});

			var popup = monster.ui.dialog(dialogTemplate, {
				title: '<i class="fa fa-question-circle monster-primary-color"></i>',
				position: ['center', 20],
				dialogClass: 'monster-alert'
			});
		},

		usersBindEvents: function(template, parent, data) {
			var self = this,
				currentNumberSearch = '',
				currentUser,
				currentCallflow,
				existingExtensions = data.existingExtensions,
				extensionsToSave,
				numbersToSave,
				extraSpareNumbers,
				unassignedDevices,
				toastrMessages = self.i18n.active().users.toastrMessages,
				mainDirectoryId,
				mainCallflowId,
				listUsers = data,
				renderFindMeFollowMeFeature = function(featureCallback) {
					monster.parallel({
							userDevices: function(callback) {
								self.usersListDeviceUser(currentUser.id, function(devices) {
									callback(null, devices);
								});
							},
							userCallflow: function(callback) {
								self.usersGetMainCallflow(currentUser.id, function(callflow) {
									callback(null, callflow);
								});
							}
						},
						function(error, results) {
							self.usersRenderFindMeFollowMe($.extend(true, results, { currentUser: currentUser, saveCallback: featureCallback }));
						}
					);
				};

			setTimeout(function() { template.find('.search-query').focus() });

			template.find('.grid-row:not(.title) .grid-cell').on('click', function() {
				var cell = $(this),
					type = cell.data('type'),
					row = cell.parents('.grid-row'),
					userId = row.data('id');

				template.find('.edit-user').slideUp("400", function() {
					$(this).empty();
				});

				if(cell.hasClass('active')) {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');

					self.usersRemoveOverlay();
					cell.css({
						'position': 'initial',
						'z-index': '0'
					});

					cell.parent().siblings('.edit-user').css({
						'position': 'initial',
						'z-index': '0',
						'border-top-color': '#a6a7a9'
					});
				}
				else {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');
					cell.toggleClass('active');
					row.toggleClass('active');

					cell.css({
						'position': 'relative',
						'z-index': '2'
					});

					cell.parent().siblings('.edit-user').css({
						'position': 'relative',
						'z-index': '2',
						'border-top-color': 'transparent'
					});

					self.usersGetTemplate(type, userId, listUsers, function(template, data) {
						if(type === 'name') {
							currentUser = data;

							template.find('#user_timezone').chosen({search_contains: true, width: "220px"});

							data.extra.differentEmail ? template.find('.email-group').show() : template.find('.email-group').hide();

							if(data.extra.mainDirectoryId) {
								mainDirectoryId = data.extra.mainDirectoryId;
							}

							if(data.extra.mainCallflowId) {
								mainCallflowId = data.extra.mainCallflowId;
							}
						}
						else if(type === 'numbers') {
							extensionsToSave = [];
							extraSpareNumbers = [];
							currentCallflow = data.callflow;
							currentUser = data.user;

							monster.ui.tooltips(template);

							_.each(data.extensions, function(number) {
								extensionsToSave.push(number);
							});
						}
						else if(type === 'extensions') {
							existingExtensions = data.allExtensions;
							currentCallflow = data.callflow;
							currentUser = data.user;
							numbersToSave = [];

							_.each(data.assignedNumbers, function(v) {
								numbersToSave.push(v.phoneNumber);
							});
						}
						else if(type === 'features') {
							currentUser = data;
						}
						else if (type === 'devices') {
							setTimeout(function() { template.find('.search-query').focus(); });
							currentUser = userId;
							unassignedDevices = {};
						}

						row.find('.edit-user').append(template).slideDown(400, function() {
							$('body').animate({ scrollTop: row.offset().top - (window.innerHeight - row.height() - 10) });
						});

						$('body').append($('<div id="users_container_overlay"></div>'));
					});
				}
			});

			template.find('.users-header .search-query').on('keyup', function() {
				var searchString = $(this).val().toLowerCase(),
					rows = template.find('.user-rows .grid-row:not(.title)'),
					emptySearch = template.find('.user-rows .empty-search-row');

				_.each(rows, function(row) {
					var row = $(row);

					row.data('search').toLowerCase().indexOf(searchString) < 0 ? row.hide() : row.show();
				});

				if(rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.find('.users-header .add-user').on('click', function() {
				monster.parallel({
						callflows: function(callback) {
							self.usersListCallflows(function(callflows) {
								callback(null, callflows);
							});
						},
						vmboxes: function(callback) {
							self.usersListVMBoxes(function(vmboxes) {
								callback(null, vmboxes);
							});
						}
					},
					function(err, results) {
						var originalData = self.usersFormatAddUser(results),
							userTemplate = $(monster.template(self, 'users-creation', originalData));

						monster.ui.mask(userTemplate.find('#extension'), 'extension');

						monster.ui.validate(userTemplate.find('#form_user_creation'), {
							rules: {
								'callflow.extension': {
									checkList: originalData.listExtensions
								},
								'vmbox.number': {
									checkList: originalData.listVMBoxes
								},
								'user.password': {
									minlength: 6
								}
							},
							messages: {
								'user.first_name': {
									required: self.i18n.active().validation.required
								},
								'user.last_name': {
									required: self.i18n.active().validation.required
								},
								'callflow.extension': {
									required: self.i18n.active().validation.required
								}
							}
						});

						monster.ui.showPasswordStrength(userTemplate.find('#password'));

						userTemplate.find('#create_user').on('click', function() {
							if(monster.ui.valid(userTemplate.find('#form_user_creation'))) {
								var dataForm = monster.ui.getFormData('form_user_creation'),
									formattedData = self.usersFormatCreationData(dataForm);

								$(this)
									.prop({ disabled: 'true' });

								self.usersCreate(formattedData, function(data) {
									popup.dialog('close').remove();

									self.usersRender({ userId: data.user.id });
								});
							}
						});

						userTemplate.find('#notification_email').on('change', function() {
							userTemplate.find('.email-group').toggleClass('hidden');
						});

						var popup = monster.ui.dialog(userTemplate, {
							title: self.i18n.active().users.dialogCreationUser.title
						});
					}
				);
			});

			template.on('click', '.cancel-link', function() {
				template.find('.edit-user').slideUp("400", function() {
					$(this).empty();
					template.find('.grid-cell.active').css({
						'position': 'inline-block',
						'z-index': '0'
					});
					template.find('.grid-row.active .edit-user').css({
						'position': 'block',
						'z-index': '0'
					});
					template.find('.grid-row.active').removeClass('active');

					self.usersRemoveOverlay();

					template.find('.grid-cell.active').removeClass('active');
				});
			});

			/* Events for Extensions details */
			template.on('click', '.save-extensions', function() {
				var $this = $(this),
					numbers = $.extend(true, [], numbersToSave),
					name = $this.parents('.grid-row').find('.grid-cell.name').text(),
					userId = $this.parents('.grid-row').data('id'),
					extensionsList = [];

				template.find('.extensions .list-assigned-items .item-row').each(function(k, row) {
					var row = $(row),
						number;

					number = (row.data('id') ? row.data('id') : row.find('.input-extension').val()) + '';

					numbers.push(number);
					extensionsList.push(number);
				});

				if(numbers.length > 0) {
					var updateCallflow = function() {
						self.usersUpdateCallflowNumbers(userId, (currentCallflow || {}).id, numbers, function(callflowData) {
							toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: name }));

							self.usersRender({ userId: callflowData.owner_id });
						});
					};

					if(self.usersHasProperPresenceId(extensionsList, currentUser)) {
						updateCallflow();
					}
					else {
						var oldPresenceId = currentUser.presence_id;
						self.usersUpdatePresenceIDPopup(extensionsList, currentUser, function(user) {
							// Update the user and the vmbox with the new presence_id / main number
							self.usersUpdateUser(user, function() {
								self.usersSmartUpdateVMBox({ 
									user: user, 
									callback: function() {
										updateCallflow();
									},
									oldPresenceId: oldPresenceId,
									userExtension: extensionsList[0]
								});
							});
						});
					}
				}
				else {
					monster.ui.alert('warning', self.i18n.active().users.noNumberCallflow);
				}
			});

			template.on('click', '#add_extensions', function() {
				var nextExtension = parseInt(monster.util.getNextExtension(existingExtensions)) + '',
					dataTemplate = {
						recommendedExtension: nextExtension
					},
					newLineTemplate = $(monster.template(self, 'users-newExtension', dataTemplate)),
					listExtensions = template.find('.extensions .list-assigned-items');

				monster.ui.mask(newLineTemplate.find('.input-extension '), 'extension');

				listExtensions.find('.empty-row').hide();

				listExtensions.append(newLineTemplate);

				existingExtensions.push(nextExtension);
			});

			template.on('click', '.remove-extension', function() {
				var phoneRow = $(this).parents('.item-row'),
					emptyRow = phoneRow.siblings('.empty-row');

				phoneRow.slideUp(function() {
					phoneRow.remove();

					if(!template.find('.list-assigned-items .item-row').is(':visible')) {
						emptyRow.slideDown();
					}
				});
			});

			template.on('click', '.cancel-extension-link', function() {
				var extension = $(this).siblings('input').val(),
					index = existingExtensions.indexOf(extension);

				if(index > -1) {
					existingExtensions.splice(index, 1);
				}

				$(this).parents('.item-row').remove();
			});

			template.on('click', '#delete_user', function() {
				var dataUser = $(this).parents('.grid-row').data();

				self.usersDeleteDialog(dataUser, function(data) {
					toastr.success(monster.template(self, '!' + self.i18n.active().users.toastrMessages.userDelete, { name: data.first_name + ' ' + data.last_name }));
					self.usersRender();
				});
			});

			template.on('change', '#notification_email', function() {
				if ( template.find('.email-border').hasClass('open') ) {
					template.find('.email-border').removeClass('open', 400);
					template.find('.email-group').slideUp();
				} else {
					template.find('.email-group').slideDown();
					template.find('.email-border').addClass('open', 400);
				}
			});

			template.on('click', '.save-user', function() {
				var formData = monster.ui.getFormData('form-'+currentUser.id),
					form = template.find('#form-'+currentUser.id);

				monster.util.checkVersion(currentUser, function() {
					if(monster.ui.valid(form)) {
						currentUser.extra.vmbox.timezone = formData.timezone;

						var userToSave = $.extend(true, {}, currentUser, formData),
							oldPresenceId = currentUser.presence_id;

						monster.parallel({
								vmbox: function(callback) {
									self.usersSmartUpdateVMBox({
										user: userToSave, 
										callback: function(vmbox) {
											callback(null, vmbox);
										},
										oldPresenceId: oldPresenceId
									});
								},
								user: function(callback) {
									self.usersUpdateUser(userToSave, function(userData) {
										callback(null, userData.data);
									});
								},
								callflow: function(callback) {
									if(userToSave.extra.ringingTimeout && userToSave.features.indexOf('find_me_follow_me') < 0) {
										self.usersGetMainCallflow(userToSave.id, function(mainCallflow) {
											if('flow' in mainCallflow) {
												var flow = mainCallflow.flow;
												while(flow.module != 'user' && '_' in flow.children) {
													flow = flow.children['_'];
												}
												flow.data.timeout = parseInt(userToSave.extra.ringingTimeout);
												self.usersUpdateCallflow(mainCallflow, function(updatedCallflow) {
													callback(null, updatedCallflow);
												});
											} else {
												callback(null, null);
											}
										});
									} else {
										callback(null, null);
									}
								}
							},
							function(error, results) {
								toastr.success(monster.template(self, '!' + toastrMessages.userUpdated, { name: results.user.first_name + ' ' + results.user.last_name }));

								self.usersRender({ userId: results.user.id });
							}
						);
					}
				});
			});

			template.on('click', '#change_pin', function() {
				var pinTemplate = $(monster.template(self, 'users-changePin')),
					form = pinTemplate.find('#form_new_pin');

				//monster.ui.validate(form);

				monster.ui.validate(form, {
					rules: {
						'pin': {
							number: true,
							minlength:4,
							min: 0
						}
					}
				});

				pinTemplate.find('.save-new-pin').on('click', function() {
					var formData = monster.ui.getFormData('form_new_pin'),
						vmboxData = $.extend(true, currentUser.extra.vmbox, formData);

					if(monster.ui.valid(form)) {
						self.usersUpdateVMBox(vmboxData, function(data) {
							popup.dialog('close').remove();

							toastr.success(monster.template(self, '!' + toastrMessages.pinUpdated, { name: currentUser.first_name + ' ' + currentUser.last_name }));
						});
					}
				});

				pinTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				var popup = monster.ui.dialog(pinTemplate, {
					title: self.i18n.active().users.dialogChangePin.title
				});
			});

			template.on('click', '#change_username', function() {
				var passwordTemplate = $(monster.template(self, 'users-changePassword', currentUser)),
					form = passwordTemplate.find('#form_new_username');

				monster.ui.showPasswordStrength(passwordTemplate.find('#inputPassword'));

				monster.ui.validate(form, {
					rules: {
						'password': {
							minlength: 6
						}
					}
				});

				passwordTemplate.find('.reset-password').on('click', function() {
					var dataReset = {
						username: currentUser.username,
						account_name: monster.apps.auth.currentAccount.name
					};

					self.usersResetPassword(dataReset, function() {
						popup.dialog('close').remove();

						toastr.success(monster.template(self, '!' + toastrMessages.successResetPassword, { name: dataReset.username }));
					});
				});

				passwordTemplate.find('.save-new-username').on('click', function() {
					var formData = monster.ui.getFormData('form_new_username'),
						userToSave = $.extend(true, {}, currentUser, formData);

					if(monster.ui.valid(form)) {
						if(!currentUser.extra.differentEmail) {
							userToSave.email = userToSave.username;
						}

						self.usersUpdateUser(userToSave, function(userData) {
							currentUser.username = userData.data.username;
							template.find('#username').html(userData.data.username);

							if(!currentUser.extra.differentEmail) {
								template.find('#email').val(userData.data.email);
								currentUser.email = userData.username;
							}

							popup.dialog('close').remove();

							toastr.success(monster.template(self, '!' + toastrMessages.userUpdated, { name: userData.data.first_name + ' ' + userData.data.last_name }));
						});
					}
				});

				passwordTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				var popup = monster.ui.dialog(passwordTemplate, {
					title: self.i18n.active().users.dialogChangePassword.title
				});
			});

			template.on('click', '#open_fmfm_link', function() {
				renderFindMeFollowMeFeature(function(usersRenderArgs) {
					usersRenderArgs.openedTab = 'name';
					self.usersRender(usersRenderArgs);
				});
			});

			template.on('focus', '.ringing-timeout.disabled #ringing_timeout', function() {
				$(this).blur();
			});

			/* Events for Devices in Users */
			template.on('click', '.create-device', function() {
				var $this = $(this),
					type = $this.data('type'),
					userId = $this.parents('.grid-row').data('id');

				monster.pub('voip.devices.renderAdd', {
					type: type,
					callback: function(device) {
						var rowDevice = monster.template(self, 'users-rowSpareDevice', device),
							listAssigned = template.find('.list-assigned-items');

						listAssigned.find('.empty-row').hide();
						listAssigned.append(rowDevice);
					}
				});
			});

			template.on('click', '.spare-devices:not(.disabled)', function() {
				var currentlySelected = $.map(template.find('.device-list.list-assigned-items .item-row'), function(val) { return $(val).data('id') });
				self.usersGetDevicesData(function(devicesData) {
					var spareDevices = {};
					_.each(devicesData, function(device) {
						if( (!('owner_id' in device) || device.owner_id === '' || device.owner_id === currentUser) && currentlySelected.indexOf(device.id) === -1 ) {
							spareDevices[device.id] = device;
						}
					});

					monster.pub('common.monsterListing.render', {
						dataList: spareDevices,
						dataType: 'devices',
						okCallback: function(devices) {
							_.each(devices, function(device) {
								var rowDevice = monster.template(self, 'users-rowSpareDevice', device),
									listAssigned = template.find('.list-assigned-items');

								listAssigned.find('.empty-row').hide();
								listAssigned.append(rowDevice);

								if(device.owner_id) {
									delete unassignedDevices[device.id];
								}
							});
						}
					});
				});
			});

			template.on('click', '.save-devices', function() {
				var dataDevices = {
						new: [],
						old: []
					},
					name = $(this).parents('.grid-row').find('.grid-cell.name').text(),
					userId = $(this).parents('.grid-row').data('id');

				template.find('.detail-devices .list-assigned-items .item-row:not(.assigned)').each(function(k, row) {
					dataDevices.new.push($(row).data('id'));
				});
				dataDevices.old = _.keys(unassignedDevices);

				self.usersUpdateDevices(dataDevices, userId, function() {
					toastr.success(monster.template(self, '!' + toastrMessages.devicesUpdated, { name: name }));
					self.usersRender({ userId: userId });
				});
			});

			template.on('click', '.detail-devices .edit-device-link', function() {
				var row = $(this).parents('.item-row'),
					id = row.data('id'),
					userId = $(this).parents('.grid-row').data('id');

				monster.pub('voip.devices.editDevice', { 
						data: { id: id }, 
						callbackSave: function(device) {
							row.find('.edit-device').html(device.name);
						},
						callbackDelete: function(device) {
							self.usersRender({ userId: userId, openedTab: 'devices' });
						}
					}
				);
			});

			template.on('click', '.detail-devices .list-assigned-items .remove-device', function() {
				var row = $(this).parents('.item-row'),
					userId = template.find('.grid-row.active').data('id'),
					deviceId = row.data('id'),
					userData = _.find(data.users, function(user, idx) { return user.id === userId; }),
					deviceData = _.find(userData.extra.devices, function(device, idx) { return device.id === deviceId; }),
					removeDevice = function () {
						if(row.hasClass('assigned')) {
							unassignedDevices[row.data('id')] = true;
						}
						row.remove();
						var rows = template.find('.detail-devices .list-assigned-items .item-row');
						if(rows.is(':visible') === false) {
							template.find('.detail-devices .list-assigned-items .empty-row').show();
						}
					};

				if (deviceData && deviceData.type === 'mobile') {
					monster.ui.confirm(
						self.i18n.active().users.confirmMobileUnAssignment.replace(
							'{{variable}}',
							monster.util.formatPhoneNumber(deviceData.mobile.mdn)
						),
						removeDevice
					);
				}
				else {
					removeDevice();
				}
			});

			/* Events for Numbers in Users */
			template.on('click', '.detail-numbers .list-assigned-items .remove-number', function() {
				var $this = $(this),
					row = $this.parents('.item-row');

				if (row.data('type') !== 'mobile') {
					extraSpareNumbers.push(row.data('id'));

					row.slideUp(function() {
						row.remove();

						if ( !template.find('.list-assigned-items .item-row').is(':visible') ) {
							template.find('.list-assigned-items .empty-row').slideDown();
						}

						template.find('.spare-link').removeClass('disabled');
					});
				}
			});

			template.on('click', '.actions .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var $this = $(this),
					args = {
						accountName: monster.apps['auth'].currentAccount.name,
						accountId: self.accountId,
						ignoreNumbers: $.map(template.find('.item-row'), function(row) {
							return $(row).data('id');
						}),
						extraNumbers: extraSpareNumbers,
						callback: function(numberList, remainingQuantity) {
							template.find('.empty-row').hide();

							_.each(numberList, function(val, idx) {
								template
									.find('.list-assigned-items')
									.append($(monster.template(self, 'users-numbersItemRow', {
										number: val
									})));

								var numberDiv = template.find('[data-id="'+val.phoneNumber+'"]'),
									args = {
										target: numberDiv.find('.edit-features'),
										numberData: val,
										afterUpdate: function(features) {
											monster.ui.paintNumberFeaturesIcon(features, numberDiv.find('.features'));
										}
									};

								monster.pub('common.numberFeaturesMenu.render', args);

								extraSpareNumbers = _.without(extraSpareNumbers, val.phoneNumber);
							});

							monster.ui.tooltips(template);

							if(remainingQuantity == 0) {
								template.find('.spare-link').addClass('disabled');
							}
						}
					};

				monster.pub('common.numbers.dialogSpare', args);
			});

			template.on('click', '.actions .buy-link', function(e) {
				e.preventDefault();

				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
					callbacks: {
						success: function(numbers) {
							_.each(numbers, function(number, k) {
								number.phoneNumber = number.id;

								var rowTemplate = $(monster.template(self, 'users-numbersItemRow', {
										number: number
									})),
									argsFeatures = {
										target: rowTemplate.find('.edit-features'),
										numberData: number,
										afterUpdate: function(features) {
											monster.ui.paintNumberFeaturesIcon(features, rowTemplate.find('.features'));
										}
									};

								monster.pub('common.numberFeaturesMenu.render', argsFeatures);

								monster.ui.tooltips(rowTemplate);

								template.find('.list-assigned-items .empty-row').hide();
								template.find('.list-assigned-items').append(rowTemplate);
							});
						}
					}
				});
			});

			template.on('click', '.save-numbers', function() {
				var $this = $(this),
					dataNumbers = $.extend(true, [], extensionsToSave),
					name = $this.parents('.grid-row').find('.grid-cell.name').text(),
					userId = $this.parents('.grid-row').data('id');

				template.find('.item-row').each(function(k, row) {
					var row = $(row),
						number = row.data('id'),
						type = row.data('type');

					if (type !== 'mobile') {
						dataNumbers.push(number);
					}
				});

				if(dataNumbers.length > 0) {
					self.usersUpdateCallflowNumbers(userId, (currentCallflow || {}).id, dataNumbers, function(callflowData) {
						var afterUpdate = function() {
							toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: name }));

							self.usersRender({ userId: callflowData.owner_id });
						};

						// If the User has the External Caller ID Number setup to a number that is no longer assigned to this user, then remove the Caller-ID Feature
						if(currentUser.caller_id.hasOwnProperty('external')
						&& currentUser.caller_id.external.hasOwnProperty('number')
						&& callflowData.numbers.indexOf(currentUser.caller_id.external.number) < 0) {
							delete currentUser.caller_id.external.number;

							self.usersUpdateUser(currentUser, function() {
								afterUpdate();

								toastr.info(toastrMessages.callerIDDeleted);
							});
						}
						else {
							afterUpdate();
						}
					});
				}
				else {
					monster.ui.alert('warning', self.i18n.active().users.noNumberCallflow);
				}
			});

			template.on('click', '.feature[data-feature="caller_id"]', function() {
				self.usersRenderCallerId(currentUser);
			});

			template.on('click', '.feature[data-feature="call_forward"]', function() {
				if(currentUser.features.indexOf('find_me_follow_me') < 0) {
					var featureUser = $.extend(true, {}, currentUser);
					self.usersGetMainCallflow(featureUser.id, function(mainCallflow) {
						if(mainCallflow && 'flow' in mainCallflow) {
							var flow = mainCallflow.flow;
							while(flow.module != 'user' && '_' in flow.children) {
								flow = flow.children['_'];
							}
							if(flow.data.timeout < 30) {
								featureUser.extra.timeoutTooShort = true;
							}
						}
						self.usersRenderCallForward(featureUser);
					});
				} else {
					self.usersRenderCallForward(currentUser);
				}
			});

			template.on('click', '.feature[data-feature="hotdesk"]', function() {
				self.usersRenderHotdesk(currentUser);
			});

			template.on('click', '.feature[data-feature="find_me_follow_me"]', function() {
				renderFindMeFollowMeFeature();
			});

			template.on('click', '.feature[data-feature="call_recording"]', function() {
				self.usersGetMainCallflow(currentUser.id, function(callflow) {
					if(callflow) {
						self.usersRenderCallRecording({
							userCallflow: callflow,
							currentUser: currentUser
						});
					} else {
						monster.ui.alert('error', self.i18n.active().users.callRecording.noNumber);
					}
				});
			});

			template.on('click', '.feature[data-feature="music_on_hold"]', function() {
				self.usersRenderMusicOnHold(currentUser);
			});

			template.on('click', '.feature[data-feature="vm_to_email"]', function() {
				self.usersListVMBoxesUser(currentUser.id, function(vmboxes) {
					currentUser.extra.deleteAfterNotify = true;
					if(vmboxes.length > 0) {
						self.usersGetVMBox(vmboxes[0].id, function(data) {
							currentUser.extra.deleteAfterNotify = data.delete_after_notify;

							self.usersRenderVMToEmail(currentUser);
						});
					}
					else {
						self.usersRenderVMToEmail(currentUser);
					}
				});
			});

			template.on('click', '.feature[data-feature="conferencing"]', function() {
				self.usersGetConferenceFeature(currentUser.id, function(dataConf) {
					var data = {
						listConferences: dataConf.listConfNumbers,
						user: currentUser,
						conference: dataConf.conference
					};

					if(_.isEmpty(data.listConferences)) {
						monster.ui.alert('error', self.i18n.active().users.conferencing.noConfNumbers);
					}
					else {
						self.usersRenderConferencing(data);
					}
				});
			});

			template.on('click', '.feature[data-feature="faxing"]', function() {
				if(!monster.util.isTrial()) {
					monster.parallel({
							numbers: function(callback) {
								self.usersListNumbers(function(listNumbers) {
									var spareNumbers = {};

									_.each(listNumbers.numbers, function(number, key) {
										if(!number.hasOwnProperty('used_by') || number.used_by === '') {
											spareNumbers[key] = number;
										}
									});

									callback && callback(null, spareNumbers);
								});
							},
							callflows: function(callback) {
								self.usersListCallflowsUser(currentUser.id, function(callflows) {
									var existingCallflow;

									_.each(callflows, function(callflow) {
										if(callflow.type === 'faxing') {
											existingCallflow = callflow;

											return false;
										}
									});

									if ( existingCallflow ) {
										self.callApi({
											resource: 'callflow.get',
											data: {
												accountId: self.accountId,
												callflowId: existingCallflow.id
											},
											success: function(data, status) {
												callback && callback(null, data.data);
											}
										});
									} else {
										callback && callback(null, existingCallflow);
									}
								});
							},
							account: function(callback) {
								self.callApi({
									resource: 'account.get',
									data: {
										accountId: self.accountId
									},
									success: function(data, status) {
										callback(null, data.data);
									}
								});
							}
						},
						function(err, results) {
							results.user = currentUser;

							if ( typeof results.callflows !== 'undefined' ) {
								// Compatibility with old version
								var faxboxId = results.callflows.flow.data.hasOwnProperty('faxbox_id') ? results.callflows.flow.data.faxbox_id : results.callflows.flow.data.id;

								self.callApi({
									resource: 'faxbox.get',
									data: {
										accountId: self.accountId,
										faxboxId: faxboxId
									},
									success: function(_data) {
										results.faxbox = _data.data;

										results.faxbox.id = faxboxId;

										self.usersRenderFaxboxes(results);
									},
									error: function() {
										self.usersRenderFaxboxes(results);
									}
								});
							} else {
								self.usersRenderFaxboxes(results);
							}
						}
					);
				}
				else {
					monster.ui.alert('warning', self.i18n.active().users.faxing.trialError);
				}
			});

			$('body').on('click', '#users_container_overlay', function() {
				template.find('.edit-user').slideUp("400", function() {
					$(this).empty();
				});

				self.usersRemoveOverlay();

				template.find('.grid-cell.active').css({
					'position': 'inline-block',
					'z-index': '0'
				});

				template.find('.grid-row.active').parent().siblings('.edit-user').css({
					'position': 'block',
					'z-index': '0'
				});

				template.find('.grid-cell.active').removeClass('active');
				template.find('.grid-row.active').removeClass('active');

			});
		},

		usersUpdatePresenceIDPopup: function(numbers, user, callback) {
			var self = this,
				dataTemplate = {
					numbers: numbers
				},
				template = $(monster.template(self, 'users-changePresenceIDPopup', dataTemplate)),
				$options = template.find('.presence-id-option');

			$options.on('click', function() {
				$options.removeClass('active');
				$(this).addClass('active');
			});

			template.find('.save-presence-id').on('click', function() {
				var newPresenceID = template.find('.presence-id-option.active').data('number');

				if(newPresenceID !== 'none') {
					user.presence_id = newPresenceID + '';
				}
				else {
					delete user.presence_id;
				}

				popup.dialog('close').remove();

				callback && callback(user);
			});

			template.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			var popup = monster.ui.dialog(template, {
				title: self.i18n.active().users.presenceIDPopup.title,
				position: ['center', 20]
			});
		},

		// Check if a user's presence id is one of its extensions
		usersHasProperPresenceId: function(listNumbers, user) {
			var self = this;

			if(user.presence_id) {
				var found = false,
					formattedPresenceID = '' + user.presence_id;

				_.each(listNumbers, function(number) {
					if(number === formattedPresenceID) {
						found = true;
					}
				});

				return found;
			}
			else if(listNumbers.length) {
				return false;
			}
			else {
				return true;
			}
		},

		usersFormatAddUser: function(data) {
			var self = this,
				formattedData = {
					sendToSameEmail: true,
					nextExtension: '',
					listExtensions: {},
					listVMBoxes:{},
				},
				arrayExtensions = [],
				arrayVMBoxes = [],
				allNumbers = [];

			_.each(data.callflows, function(callflow) {
				_.each(callflow.numbers, function(number) {
					if(number.length < 7) {
						formattedData.listExtensions[number] = callflow;
						arrayExtensions.push(number);
					}
				});
			});

			_.each(data.vmboxes, function(vmbox) {
				formattedData.listVMBoxes[vmbox.mailbox] = vmbox;
				arrayVMBoxes.push(vmbox.mailbox);
			});

			// We concat both arrays because we want to create users with the same number for the extension # and the vmbox, 
			// If for some reason a vmbox number exist without an extension, we still don't want to let them set their extension number to that number.
			allNumbers = arrayExtensions.concat(arrayVMBoxes);
			formattedData.nextExtension = parseInt(monster.util.getNextExtension(allNumbers)) + '';

			return formattedData;
		},

		usersFormatFaxingData: function(data) {
			var tempList = [],
				listNumbers = {};

			_.each(data.numbers, function(val, key){
				tempList.push(key);
			});

			tempList.sort(function(a, b) {
				return a < b ? -1 : 1;
			});

			if(data.callflows) {
				if(data.callflows.numbers.length > 0) {
					listNumbers[data.callflows.numbers[0]] = data.callflows.numbers[0]
				}
			}

			_.each(tempList, function(val, key) {
				listNumbers[val] = val;
			});

			data.extra = $.extend(true, {}, data.extra, {
				listNumbers: listNumbers
			});

			return data;
		},

		usersRenderConferencing: function(data) {
			var self = this,
				data = self.usersFormatConferencingData(data),
				featureTemplate = $(monster.template(self, 'users-feature-conferencing', data)),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#conferencing_form');

			monster.ui.validate(featureForm);
			monster.ui.mask(featureTemplate.find('#pin'), 'extension');

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var args = {
					openedTab: 'features',
					callback: function() {
						popup.dialog('close').remove();
					}
				};

				if(monster.ui.valid(featureForm)) {
					data.conference = monster.ui.getFormData('conferencing_form');

					if(switchFeature.prop('checked')) {
						self.usersUpdateConferencing(data, function(data) {
							args.userId = data.user.id;

							self.usersRender(args);
						});
					}
					else {
						self.usersDeleteConferencing(data.user.id, function() {
							args.userId = data.user.id;

							self.usersRender(args);
						});
					}
				}
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: data.user.extra.mapFeatures.conferencing.title,
				position: ['center', 20]
			});
		},

		usersFormatConferencingData: function(data) {
			return data;
		},

		usersRenderFaxboxes: function(data) {
			var self = this,
				data = self.usersFormatFaxingData(data),
				featureTemplate = $(monster.template(self, 'users-feature-faxing', data)),
				numberMirror = featureTemplate.find('.number-mirror'),
				switchFeature = featureTemplate.find('.switch-state'),
				popup = monster.ui.dialog(featureTemplate, {
					title: data.user.extra.mapFeatures.faxing.title,
					position: ['center', 20]
				});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			monster.pub('common.numberSelector.render', {
				container: featureTemplate.find('.number-select'),
				inputName: 'caller_id',
				number: data.hasOwnProperty('faxbox') ? data.faxbox.caller_id : undefined,
				removeCallback: function () {
					featureTemplate
						.find('.number-mirror')
							.text(self.i18n.active().users.faxing.emailToFax.default);
				},
				globalAddNumberCallback: function (number, addNumberToControl) {
					var found = false,
						// Number can come back from the buy common control, as an object, or from the spare selector, as a string
						foundNumber = _.isObject(number) ? _.keys(number)[0] : number;

					addNumberToControl && addNumberToControl(foundNumber);

					featureTemplate
						.find('.number-mirror')
							.text(foundNumber);
				}
			});

			featureTemplate.find('#helper_content').on('shown', function() {
				$(this).siblings('a').find('.text').text(self.i18n.active().users.faxing.emailToFax.help.hideHelp);
				$(this).find('#destination_number').focus();
			});

			featureTemplate.find('#helper_content').on('hidden', function() {
				$(this).siblings('a').find('.text').text(self.i18n.active().users.faxing.emailToFax.help.showHelp);
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('.save').on('click', function() {
				var newNumber = featureTemplate.find('input[name="caller_id"]').val(),
					args = {
						openedTab: 'features',
						callback: function() {
							popup.dialog('close').remove();
						}
					};

				if ( switchFeature.prop('checked')) {
					if (newNumber !== '') {
						self.usersUpdateFaxing(data, newNumber, function(results) {
							args.userId = results.callflow.owner_id;

							self.usersRender(args);
						});
					}
					else {
						monster.ui.alert('error', self.i18n.active().users.faxing.toastr.error.numberMissing);
					}
				} else {
					self.usersDeleteFaxing(data.user.id, function() {
						args.userId = data.user.id;

						self.usersRender(args);
					});
				}
			});
		},

		usersRenderHotdesk: function(currentUser) {
			var self = this,
				featureTemplate = $(monster.template(self, 'users-feature-hotdesk', currentUser)),
				switchFeature = featureTemplate.find('.switch-state'),
				requirePin = featureTemplate.find('[name="require_pin"]'),
				featureForm = featureTemplate.find('#hotdesk_form');

			monster.ui.validate(featureForm);

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			requirePin.on('change', function() {
				if(requirePin.is(':checked')) {
					featureTemplate.find('#pin')
						.removeAttr('disabled', 'disabled')
						.focus();
				}
				else {
					featureTemplate.find('#pin')
						.val('')
						.attr('disabled', 'disabled');
				}
			});

			featureTemplate.find('.save').on('click', function() {
				if(monster.ui.valid(featureForm)) {
					var formData = monster.ui.getFormData('hotdesk_form'),
					args = {
						openedTab: 'features',
						callback: function() {
							popup.dialog('close').remove();
						}
					};

					formData.enabled = switchFeature.prop('checked');
					
					if(formData.require_pin === false) { delete formData.pin; }
					delete currentUser.hotdesk;

					userToSave = $.extend(true, {}, currentUser, { hotdesk: formData });

					self.usersUpdateUser(userToSave, function(data) {
						args.userId = data.data.id;

						self.usersRender(args);
					});
				}
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: currentUser.extra.mapFeatures.hotdesk.title,
				position: ['center', 20]
			});
		},

		usersRenderVMToEmail: function(currentUser) {
			var self = this,
				featureTemplate = $(monster.template(self, 'users-feature-vm_to_email', currentUser)),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#vm_to_email_form');

			monster.ui.validate(featureForm);

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var formData = monster.ui.getFormData('vm_to_email_form'),
					userToSave = $.extend(true, {}, currentUser),
					enabled = switchFeature.prop('checked'),
					args = {
						callback: function() {
							popup.dialog('close').remove();
						},
						openedTab: 'features'
					},
					updateUser = function(user) {
						self.usersUpdateUser(user, function(data) {
							args.userId = data.data.id;

							self.usersRender(args);
						});
					},
					/* updates all the vmboxes with the new delete after notify setting, and then calls the callback*/
					updateVMsDeleteAfterNotify = function(val, userId, callbackAfterUpdate) {
						self.usersListVMBoxesUser(userId, function(vmboxes) {
							var listFnParallel = [];

							_.each(vmboxes, function(vm) {
								listFnParallel.push(function(callback) {
									self.usersGetVMBox(vm.id, function(data) {
										/* Only update vms if the deleteAfterNotify value is different than before */
										if(data.delete_after_notify !== val) {
											data.delete_after_notify = val;

											self.usersUpdateVMBox(data, function(data) {
												callback(null, data);
											});
										}
										else {
											callback(null, data);
										}
									});
								});
							});

							monster.parallel(listFnParallel, function(err, results) {
								callbackAfterUpdate && callbackAfterUpdate(results);
							});
						});
					};

				userToSave.vm_to_email_enabled = enabled;

				/* Only update the email and the checkboxes if the setting is enabled */
				if(enabled === true) {
					if(monster.ui.valid(featureForm)) {
						userToSave.email = formData.email;

						/* Update VMBoxes, then update user and finally close the popup */
						updateVMsDeleteAfterNotify(formData.delete_after_notify, userToSave.id, function() {
							updateUser(userToSave);
						});
					}
				}
				else {
					updateUser(userToSave);
				}
			});

			var popup = monster.ui.dialog(featureTemplate, {
				title: currentUser.extra.mapFeatures.vm_to_email.title,
				position: ['center', 20]
			});
		},

		usersRenderCallerId: function(currentUser) {
			var self = this,
				featureTemplate = $(monster.template(self, 'users-feature-caller_id', currentUser)),
				switchFeature = featureTemplate.find('.switch-state');

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var switchCallerId = featureTemplate.find('.switch-state'),
					userData = currentUser,
					userToSave = $.extend(true, {}, {
						caller_id: {
							external: {},
						}
					}, currentUser),
					args = {
						openedTab: 'features',
						callback: function() {
							popup.dialog('close').remove();
						}
					};

				if (switchCallerId.prop('checked')) {
					var callerIdValue = featureTemplate.find('.caller-id-select').val();

					userToSave.caller_id.external.number = callerIdValue;
				}
				else {
					if(userToSave.caller_id.hasOwnProperty('external')) {
						delete userToSave.caller_id.external.number;
					}
				}

				self.usersUpdateUser(userToSave, function(data) {
					args.userId = data.data.id;

					self.usersRender(args);
				});
			});

			if(currentUser.extra.listCallerId.length > 0){
				var popup = monster.ui.dialog(featureTemplate, {
					title: currentUser.extra.mapFeatures.caller_id.title,
					position: ['center', 20]
				});
			}
			else {
				monster.ui.alert('error', self.i18n.active().users.errorCallerId);
			}
		},

		usersFormatCallForwardData: function(user) {
			var self = this,
				cfMode = 'off';

			user.extra = user.extra || {};

			//cfmode is on if call_forward.enabled = true
			//cfmode is failover if call_forward.enabled = false & call_forward.failover = true
			//cfmode is off if call_forward.enabled = false & call_forward.failover = false
			if(user.hasOwnProperty('call_forward') && user.call_forward.hasOwnProperty('enabled')) {
				if(user.call_forward.enabled === true) {
					cfMode = 'on';
				}
				else if(user.call_forward.enabled === false) {
					cfMode = user.call_forward.hasOwnProperty('failover') && user.call_forward.failover === true ? 'failover' : 'off';
				}
			}

			user.extra.callForwardMode = cfMode;

			return user;
		},

		usersRenderCallForward: function(currentUser) {
			var self = this,
				formattedCallForwardData = self.usersFormatCallForwardData(currentUser),
				featureTemplate = $(monster.template(self, 'users-feature-call_forward', formattedCallForwardData)),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#call_forward_form'),
				args = {
					callback: function() {
						popup.dialog('close').remove();
					},
					openedTab: 'features'
				},
				timeoutWarningBox = featureTemplate.find('.help-box.red-box');

			monster.ui.mask(featureTemplate.find('#number'), 'phoneNumber');

			if(currentUser.hasOwnProperty('call_forward') && currentUser.call_forward.require_keypress) {
				timeoutWarningBox.hide();
			}

			monster.ui.validate(featureForm);

			featureTemplate.find('input[name="require_keypress"]').on('change', function() {
				timeoutWarningBox.toggle();
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			featureTemplate.find('.feature-select-mode button').on('click', function() {
				var $this = $(this);

				featureTemplate.find('.feature-select-mode button').removeClass('selected monster-button-primary');
				$(this).addClass('selected monster-button-primary');

				$this.data('value') === 'off' ? featureTemplate.find('.content').slideUp() : featureTemplate.find('.content').slideDown();
				$this.data('value') === 'failover' ? featureTemplate.find('.failover-info').slideDown() : featureTemplate.find('.failover-info').slideUp();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				if(monster.ui.valid(featureForm)) {
					var formData = monster.ui.getFormData('call_forward_form');
					formData.require_keypress = !formData.require_keypress;

					var selectedType = featureTemplate.find('.feature-select-mode button.selected').data('value');
					if(selectedType === 'off') {
						formData.enabled = false;
						formData.failover = false;
					}
					else if(selectedType === 'failover') {
						formData.enabled = false;
						formData.failover = true;
					}
					else {
						formData.enabled = true;
						formData.failover = true;
					}

					formData.number = monster.util.unformatPhoneNumber(formData.number, 'keepPlus');
					delete formData.phoneType;

					var userToSave = $.extend(true, {}, currentUser, { call_forward: formData });

					if(timeoutWarningBox.is(':visible')) {
						args.openedTab = 'name';
					}

					self.usersUpdateUser(userToSave, function(data) {
						args.userId = data.data.id;

						self.usersRender(args);
					});
				}
			});

			if (currentUser.hasOwnProperty('call_forward') && currentUser.call_forward.number && /^(\+1)/.test(currentUser.call_forward.number)) {
				featureTemplate.find('#phoneType').val('mobile');
			} else {
				featureTemplate.find('#phoneType').val('deskphone');
			}

			var popup = monster.ui.dialog(featureTemplate, {
				title: currentUser.extra.mapFeatures.call_forward.title,
				position: ['center', 20]
			});

			popup.find(".monster-button").blur();
		},

		usersRenderFindMeFollowMe: function(params) {
			var self = this;

			if(!params.userCallflow) {
				monster.ui.alert('error', self.i18n.active().users.find_me_follow_me.noNumber);
			} else if(!params.userDevices || params.userDevices.length === 0) {
				monster.ui.alert('error', self.i18n.active().users.find_me_follow_me.noDevice);
			} else {
				var currentUser = params.currentUser,
					userCallflow = params.userCallflow,
					featureTemplate = $(monster.template(self, 'users-feature-find_me_follow_me', { currentUser: currentUser })),
					switchFeature = featureTemplate.find('.switch-state'),
					featureForm = featureTemplate.find('#find_me_follow_me_form'),
					args = {
						callback: function() {
							popup.dialog('close').remove();
						},
						openedTab: 'features'
					},
					userDevices = {};

				var nodeSearch = userCallflow.flow;
				while(nodeSearch.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(nodeSearch.module) < 0) {
					nodeSearch = nodeSearch.children['_'];
				}
				endpoints = nodeSearch.module === 'ring_group' ? nodeSearch.data.endpoints : [];

				_.each(params.userDevices, function(val) {
					userDevices[val.id] = val;
				});

				endpoints = $.map(endpoints, function(endpoint) {
					if(userDevices[endpoint.id]) {
						var device = userDevices[endpoint.id];
						delete userDevices[endpoint.id];
						return {
							id: endpoint.id,
							delay: endpoint.delay,
							timeout: endpoint.timeout,
							name: device.name,
							icon: self.deviceIcons[device.device_type],
							disabled: false
						}
					}
				});

				_.each(userDevices, function(device) {
					endpoints.push({
						id: device.id,
						delay: 0,
						timeout: 0,
						name: device.name,
						icon: self.deviceIcons[device.device_type],
						disabled: true
					})
				});

				monster.pub('common.ringingDurationControl.render', {
					container: featureForm,
					endpoints: endpoints,
					hasDisableColumn: true
				});

				featureTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				switchFeature.on('change', function() {
					$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
				});

				featureTemplate.find('.save').on('click', function() {
					var enabled = switchFeature.prop('checked');

					monster.pub('common.ringingDurationControl.getEndpoints', { 
						container: featureForm,
						callback: function(endpoints) {

							currentUser.smartpbx = currentUser.smartpbx || {};
							currentUser.smartpbx.find_me_follow_me = currentUser.smartpbx.find_me_follow_me || {};
							currentUser.smartpbx.find_me_follow_me.enabled = (enabled && endpoints.length > 0);

							var callflowNode = {};

							if(enabled && endpoints.length > 0) {
								callflowNode.module = 'ring_group';
								callflowNode.data = {
									strategy: "simultaneous",
									timeout: 20,
									endpoints: []
								}

								_.each(endpoints, function(endpoint) {
									callflowNode.data.endpoints.push({
										id: endpoint.id,
										endpoint_type: "device",
										delay: endpoint.delay,
										timeout: endpoint.timeout
									});

									if((endpoint.delay+endpoint.timeout) > callflowNode.data.timeout) { 
										callflowNode.data.timeout = (endpoint.delay+endpoint.timeout); 
									}
								});
							} else {
								callflowNode.module='user';
								callflowNode.data = {
									can_call_self: false,
									id: currentUser.id,
									timeout: 20
								};
							}

							// In next 5 lines, look for user/group node, and replace it with the new data;
							var flow = userCallflow.flow;
							while(flow.hasOwnProperty('module') && ['ring_group', 'user'].indexOf(flow.module) < 0) {
								flow = flow.children['_'];
							}
							flow.module = callflowNode.module;
							flow.data = callflowNode.data;

							monster.parallel({
									callflow: function(callbackParallel) {
										self.usersUpdateCallflow(userCallflow, function(data) {
											callbackParallel && callbackParallel(null, data.data);
										});
									},
									user: function(callbackParallel) {
										self.usersUpdateUser(currentUser, function(data) {
											callbackParallel && callbackParallel(null, data.data);
										});
									}
								},
								function(err, results) {
									args.userId = results.user.id;
									if(typeof params.saveCallback === 'function') {
										params.saveCallback(args);
									} else {
										self.usersRender(args);
									}
								}
							);
						}
					});
				});

				var popup = monster.ui.dialog(featureTemplate, {
					title: currentUser.extra.mapFeatures.find_me_follow_me.title,
					position: ['center', 20]
				});
			}
		},

		usersRenderCallRecording: function(params) {
			var self = this,
				templateData = $.extend(true, {
												user: params.currentUser
											},
											(params.currentUser.extra.mapFeatures.call_recording.active ? {
												url: params.userCallflow.flow.data.url,
												format: params.userCallflow.flow.data.format,
												timeLimit: params.userCallflow.flow.data.time_limit
											} : {})
										),
				featureTemplate = $(monster.template(self, 'users-feature-call_recording', templateData)),
				switchFeature = featureTemplate.find('.switch-state'),
				featureForm = featureTemplate.find('#call_recording_form'),
				popup;

			monster.ui.validate(featureForm, {
				rules: {
					'time_limit': {
						digits: true
					}
				}
			});

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('change', function() {
				$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				if(monster.ui.valid(featureForm)) {
					var formData = monster.ui.getFormData('call_recording_form'),
						enabled = switchFeature.prop('checked');

					if(!('smartpbx' in params.currentUser)) { params.currentUser.smartpbx = {}; }
					if(!('call_recording' in params.currentUser.smartpbx)) {
						params.currentUser.smartpbx.call_recording = {
							enabled: false
						};
					}

					if(params.currentUser.smartpbx.call_recording.enabled || enabled) {
						params.currentUser.smartpbx.call_recording.enabled = enabled;
						var newCallflow = $.extend(true, {}, params.userCallflow);
						if(enabled) {
							if(newCallflow.flow.module === 'record_call') {
								newCallflow.flow.data = $.extend(true, { action: "start" }, formData);
							} else {
								newCallflow.flow = {
									children: {
										"_": $.extend(true, {}, params.userCallflow.flow)
									},
									module: "record_call",
									data: $.extend(true, { action: "start" }, formData)
								}
								var flow = newCallflow.flow;
								while(flow.children && '_' in flow.children) {
									if(flow.children['_'].module === 'record_call' && flow.children['_'].data.action === 'stop') {
										break; // If there is already a Stop Record Call
									} else if(flow.children['_'].module === 'voicemail') {
										var voicemailNode = $.extend(true, {}, flow.children['_']);
										flow.children['_'] = {
											module: 'record_call',
											data: { action: "stop" },
											children: { '_': voicemailNode }
										}
										break;
									} else {
										flow = flow.children['_'];
									}
								}
							}
						} else {
							newCallflow.flow = $.extend(true, {}, params.userCallflow.flow.children["_"]);
							var flow = newCallflow.flow;
							while(flow.children && '_' in flow.children) {
								if(flow.children['_'].module === 'record_call') {
									flow.children = flow.children['_'].children;
									break;
								} else {
									flow = flow.children['_'];
								}
							}
						}
						self.usersUpdateCallflow(newCallflow, function(updatedCallflow) {
							self.usersUpdateUser(params.currentUser, function(updatedUser) {
								popup.dialog('close').remove();
									self.usersRender({
										userId: params.currentUser.id,
										openedTab: 'features'
									});
							});
						});
					} else {
						popup.dialog('close').remove();
						self.usersRender({
							userId: params.currentUser.id,
							openedTab: 'features'
						});
					}
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: params.currentUser.extra.mapFeatures.call_recording.title,
				position: ['center', 20]
			});
		},

		usersRenderMusicOnHold: function(currentUser) {
			var self = this,
				silenceMediaId = 'silence_stream://300000',
				mediaToUpload = undefined;

			self.usersListMedias(function(medias) {
				var templateData = {
						user: currentUser,
						silenceMedia: silenceMediaId,
						mediaList: medias,
						media: 'music_on_hold' in currentUser && 'media_id' in currentUser.music_on_hold ? currentUser.music_on_hold.media_id : silenceMediaId
					},
					featureTemplate = $(monster.template(self, 'users-feature-music_on_hold', templateData)),
					switchFeature = featureTemplate.find('.switch-state'),
					popup,
					closeUploadDiv = function(newMedia) {
						mediaToUpload = undefined;
						featureTemplate.find('.upload-div input').val('');
						featureTemplate.find('.upload-div').slideUp(function() {
							featureTemplate.find('.upload-toggle').removeClass('active');
						});
						if(newMedia) {
							var mediaSelect = featureTemplate.find('.media-dropdown');
							mediaSelect.append('<option value="'+newMedia.id+'">'+newMedia.name+'</option>');
							mediaSelect.val(newMedia.id);
						}
					};

				featureTemplate.find('.upload-input').fileUpload({
					inputOnly: true,
					wrapperClass: 'file-upload input-append',
					btnText: self.i18n.active().users.music_on_hold.audioUploadButton,
					btnClass: 'monster-button',
					maxSize: 5,
					success: function(results) {
						mediaToUpload = results[0];
					},
					error: function(errors) {
						if(errors.hasOwnProperty('size') && errors.size.length > 0) {
							monster.ui.alert(self.i18n.active().users.music_on_hold.fileTooBigAlert);
						}
						featureTemplate.find('.upload-div input').val('');
						mediaToUpload = undefined;
					}
				});

				featureTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				switchFeature.on('change', function() {
					$(this).prop('checked') ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
				});

				featureTemplate.find('.upload-toggle').on('click', function() {
					if($(this).hasClass('active')) {
						featureTemplate.find('.upload-div').stop(true, true).slideUp();
					} else {
						featureTemplate.find('.upload-div').stop(true, true).slideDown();
					}
				});

				featureTemplate.find('.upload-cancel').on('click', function() {
					closeUploadDiv();
				});

				featureTemplate.find('.upload-submit').on('click', function() {
					if(mediaToUpload) {
						self.callApi({
							resource: 'media.create',
							data: {
								accountId: self.accountId,
								data: {
									streamable: true,
									name: mediaToUpload.name,
									media_source: "upload",
									description: mediaToUpload.name
								}
							},
							success: function(data, status) {
								var media = data.data;
								self.callApi({
									resource: 'media.upload',
									data: {
										accountId: self.accountId,
										mediaId: media.id,
										data: mediaToUpload.file
									},
									success: function(data, status) {
										closeUploadDiv(media);
									},
									error: function(data, status) {
										self.callApi({
											resource: 'media.delete',
											data: {
												accountId: self.accountId,
												mediaId: media.id,
												data: {}
											},
											success: function(data, status) {}
										});
									}
								});
							}
						});
					} else {
						monster.ui.alert(self.i18n.active().users.music_on_hold.emptyUploadAlert);
					}
				});

				featureTemplate.find('.save').on('click', function() {
					var selectedMedia = featureTemplate.find('.media-dropdown option:selected').val(),
						enabled = switchFeature.prop('checked');

					if(!('music_on_hold' in currentUser)) {
						currentUser.music_on_hold = {};
					}

					if('media_id' in currentUser.music_on_hold || enabled) {
						if(enabled) {
							currentUser.music_on_hold = {
								media_id: selectedMedia
							};
						} else {
							currentUser.music_on_hold = {};
						}
						self.usersUpdateUser(currentUser, function(updatedUser) {
							popup.dialog('close').remove();
							self.usersRender({
								userId: currentUser.id,
								openedTab: 'features'
							});
						});
					} else {
						popup.dialog('close').remove();
						self.usersRender({
							userId: currentUser.id,
							openedTab: 'features'
						});
					}
				});

				popup = monster.ui.dialog(featureTemplate, {
					title: currentUser.extra.mapFeatures.music_on_hold.title,
					position: ['center', 20]
				});
			});
		},

		usersCleanUserData: function(userData) {
			var userData = $.extend(true, {}, userData),
				fullName = userData.first_name + ' ' + userData.last_name,
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
			if(userData.extra) {
				if(userData.extra.includeInDirectory === false) {
					if('directories' in userData && userData.extra.mainDirectoryId && userData.extra.mainDirectoryId in userData.directories) {
						delete userData.directories[userData.extra.mainDirectoryId];
					}
				}
				else {
					userData.directories = userData.directories || {};

					if(userData.extra.mainCallflowId) {
						userData.directories[userData.extra.mainDirectoryId] = userData.extra.mainCallflowId;
					}
				}

				if('differentEmail' in userData.extra && userData.extra.differentEmail) {
					if ( 'email' in userData.extra ) {
						userData.email = userData.extra.email
					}
				} else {
					userData.email = userData.username;
				}

				if('language' in userData.extra) {
					if(userData.extra.language !== 'auto') {
						userData.language = userData.extra.language;
					}
					else {
						delete userData.language;
					}
				}
			}

			if(userData.hasOwnProperty('call_forward')) {
				if(userData.call_forward.number === '') {
					delete userData.call_forward.number;
				}
			}

			// if presence_id doesn't have a proper value, delete it and remove the internal callerId
			if(!userData.hasOwnProperty('presence_id') || userData.presence_id === 'unset' || !userData.presence_id) {
				delete userData.presence_id;

				if(userData.caller_id.hasOwnProperty('internal')) {
					delete userData.caller_id.internal.number;
				}
			}
			else {
				// Always set the Internal Caller-ID Number to the Main Extension/Presence ID
				userData.caller_id.internal.number = userData.presence_id + '';
			}

			if(userData.timezone === 'inherit') {
				delete userData.timezone;
			}

			delete userData.include_directory;
			delete userData.features;
			delete userData.extra;
			delete userData[''];

			return userData;
		},

		usersGetTemplate: function(type, userId, listUsers, callbackAfterData) {
			var self = this,
				template;

			if(type === 'name') {
				self.usersGetNameTemplate(userId, listUsers, callbackAfterData);
			}
			else if(type === 'numbers') {
				self.usersGetNumbersTemplate(userId, callbackAfterData);
			}
			else if(type === 'extensions') {
				self.usersGetExtensionsTemplate(userId, callbackAfterData);
			}
			else if(type === 'features') {
				self.usersGetFeaturesTemplate(userId, listUsers, callbackAfterData);
			}
			else if(type === 'devices') {
				self.usersGetDevicesTemplate(userId, callbackAfterData);
			}
		},

		usersGetFeaturesTemplate: function(userId, listUsers, callback) {
			var self = this;

			self.usersGetUser(userId, function(userData) {
				_.each(listUsers.users, function(user) {
					if(user.id === userData.id) {
						userData = $.extend(true, userData, user);
					}
				});

				var dataTemplate = self.usersFormatUserData(userData);

				template = $(monster.template(self, 'users-features', dataTemplate));

				callback && callback(template, dataTemplate);
			});
		},
		usersGetNameTemplate: function(userId, listUsers, callbackAfterFormat) {
			var self = this;

			monster.parallel({
					mainCallflow: function(callback) {
						self.usersGetMainCallflow(userId, function(mainCallflow) {
							callback(null, mainCallflow);
						});
					},
					mainDirectory: function(callback) {
						self.usersGetMainDirectory(function(mainDirectory) {
							callback(null, mainDirectory);
						});
					},
					user: function(callback) {
						self.usersGetUser(userId, function(userData) {
							callback(null, userData);
						});
					},
					vmboxes: function(callback) {
						self.usersListVMBoxes(function(vmboxes) {
							var firstVmboxId,
								results = {
									listExisting: [],
									userVM: {}
								};

							_.each(vmboxes, function(vmbox) {
								results.listExisting.push(vmbox.mailbox);

								if(vmbox.owner_id === userId && !firstVmboxId) {
									firstVmboxId = vmbox.id;
								}
							});

							if(firstVmboxId) {
								self.usersGetVMBox(firstVmboxId, function(vmbox) {
									results.userVM = vmbox;

									callback(null, results);
								});
							}
							else {
								callback(null, results);
							}
						});
					}
				},
				function(error, results) {
					var userData = results.user;

					_.each(listUsers.users, function(user) {
						if(user.id === results.user.id) {
							userData = $.extend(true, user, userData);

							return false;
						}
					});

					var dataTemplate = self.usersFormatUserData(userData, results.mainDirectory, results.mainCallflow, results.vmboxes.userVM, results.vmboxes.listExisting);

					template = $(monster.template(self, 'users-name', dataTemplate));

					monster.ui.validate(template.find('form.user-fields'), {
						rules: {
							'extra.ringingTimeout': {
								digits: true
							}
						},
						messages: {
							'first_name': {
								required: self.i18n.active().validation.required
							},
							'last_name': {
								required: self.i18n.active().validation.required
							}
						}
					});

					timezone.populateDropdown(template.find('#user_timezone'), dataTemplate.timezone||'inherit', {inherit: self.i18n.active().defaultTimezone});

					monster.ui.tooltips(template, {
						options: {
							container: 'body'
						}
					});

					callbackAfterFormat && callbackAfterFormat(template, dataTemplate);
				}
			);
		},

		usersGetDevicesData: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersGetNumbersData: function(userId, callback, loadNumbersView) {
			var self = this,
				parallelRequests = {
					user: function(callbackParallel) {
						self.usersGetUser(userId, function(user) {
							callbackParallel && callbackParallel(null, user);
						});
					},
					callflow: function(callbackParallel) {
						var response = {};

						self.usersListCallflows(function(callflows) {
							response.list = callflows;

							var callflowId;

							$.each(callflows, function(k, callflowLoop) {
								/* Find Smart PBX Callflow of this user */
								if(callflowLoop.owner_id === userId && callflowLoop.type === 'mainUserCallflow') {
									callflowId = callflowLoop.id;

									return false;
								}
							});

							if(callflowId) {
								self.callApi({
									resource: 'callflow.get',
									data: {
										accountId: self.accountId,
										callflowId: callflowId
									},
									success: function(callflow) {
										response.userCallflow = callflow.data;

										callbackParallel && callbackParallel(null, response);
									}
								});
							}
							else {
								callbackParallel && callbackParallel(null, response);
							}
						});
					},
					numbers: function(callbackParallel) {
						self.usersListNumbers(function(listNumbers) {
							callbackParallel && callbackParallel(null, listNumbers);
						});
					}
				}

			if (loadNumbersView) {
				parallelRequests.devices = function(callbackParallel) {
					self.usersListDeviceUser(userId, function (listDevices) {
						callbackParallel && callbackParallel(null, listDevices);
					});
				};
			}

			monster.parallel(parallelRequests, function(err, results) {
				callback && callback(results);
			});
		},

		usersGetNumbersTemplate: function(userId, callback) {
			var self = this,
				template;

			self.usersGetNumbersData(userId, function(results) {
				self.usersFormatNumbersData(userId, results, function(results) {
					template = $(monster.template(self, 'users-numbers', results));

					_.each(results.assignedNumbers, function(number) {
						var numberDiv = template.find('[data-id="' + number.phoneNumber + '"]'),
							argsFeatures = {
								target: numberDiv.find('.edit-features'),
								numberData: number,
								afterUpdate: function(features) {
									monster.ui.paintNumberFeaturesIcon(features, numberDiv.find('.features'));
								}
							};

						monster.pub('common.numberFeaturesMenu.render', argsFeatures);
					});

					callback && callback(template, results);
				});
			}, true);
		},
		usersGetDevicesTemplate: function(userId, callback) {
			var self = this,
				template;

			self.usersGetDevicesData(function(results) {
				var formattedResults = self.usersFormatDevicesData(userId, results);

				template = $(monster.template(self, 'users-devices', formattedResults));

				callback && callback(template, results);
			});
		},
		usersGetExtensionsTemplate: function(userId, callback) {
			var self = this,
				template;

			self.usersGetNumbersData(userId, function(results) {
				self.usersFormatNumbersData(userId, results, function(results) {
					template = $(monster.template(self, 'users-extensions', results));

					callback && callback(template, results);
				});
			});
		},
		usersFormatDevicesData: function(userId, data) {
			var self = this,
				formattedData = {
					countSpare: 0,
					assignedDevices: {},
					unassignedDevices: {}
				};

			_.each(data, function(device) {
				if(device.owner_id === userId) {
					formattedData.assignedDevices[device.id] = device;
				}
				else if(device.owner_id === '' || !('owner_id' in device)) {
					formattedData.countSpare++;
					formattedData.unassignedDevices[device.id] = device;
				}
			});

			formattedData.emptyAssigned = _.isEmpty(formattedData.assignedDevices);
			formattedData.emptySpare = _.isEmpty(formattedData.unassignedDevices);

			return formattedData;
		},

		usersFormatNumbersData: function(userId, data, callback) {
			var self = this,
				response = {
					countSpare: 0,
					assignedNumbers: [],
					unassignedNumbers: {},
					callflow: data.callflow.userCallflow,
					extensions: [],
					user: data.user || {}
				};

			if (data.hasOwnProperty('devices') && data.devices.length) {
				_.each(data.devices, function(device, idx) {
					if (device.device_type === 'mobile') {
						data.numbers.numbers[device.mobile.mdn] = {
							assigned_to: response.user.id,
							features: [ 'mobile' ],
							isLocal: false,
							phoneNumber: device.mobile.mdn,
							state: 'in_service',
							used_by: 'mobile'
						};
					}
				});
			}

			if('numbers' in data.numbers) {
				_.each(data.numbers.numbers, function(number, k) {
					/* TODO: Once locality is enabled, we need to remove it */
					number.localityEnabled = 'locality' in number ? true : false;

					/* Adding to spare numbers */
					if(!number.hasOwnProperty('used_by') || number.used_by === '') {
						response.countSpare++;
						response.unassignedNumbers[k] = number;
					}
					else if (number.used_by === 'mobile') {
						response.assignedNumbers.push(number);
					}
				});
			}

			if(response.callflow) {
				/* If a number is in a callflow and is returned by the phone_numbers, add it to the assigned numbers  */
				_.each(response.callflow.numbers, function(number) {
					if(number in data.numbers.numbers) {
						var numberElement = data.numbers.numbers[number];
						numberElement.phoneNumber = number;
						numberElement.isLocal = numberElement.features.indexOf('local') > -1;

						response.assignedNumbers.push(numberElement);
					}
					else {
						response.extensions.push(number);
					}
				});
			}

			response.assignedNumbers = monster.util.sort(response.assignedNumbers, 'phoneNumber');

			/* List of extensions */
			response.allExtensions = [];

			_.each(data.callflow.list, function(callflow) {
				_.each(callflow.numbers, function(number) {
					/* If it's a valid extension number (ie: a number that's not in the number database) */
					if(!(number in data.numbers.numbers) && !(_.isNaN(parseInt(number)))) {
						response.allExtensions.push(number);
					}
				});
			});

			/* Sort extensions so that we can recommend an available extension to a user whom would add a new one */
			response.allExtensions.sort(function(a, b) {
				var parsedA = parseInt(a),
					parsedB = parseInt(b),
					result = -1;

				if(parsedA > 0 && parsedB > 0) {
					result = parsedA > parsedB;
				}

				return result;
			});

			response.emptyAssigned = _.isEmpty(response.assignedNumbers);
			response.emptySpare = _.isEmpty(response.unassignedNumbers);
			response.emptyExtensions = _.isEmpty(response.extensions);

			callback && callback(response);
		},

		usersFormatCreationData: function(data, callback) {
			var self = this,
				fullName = data.user.first_name + ' ' + data.user.last_name,
				callerIdName = fullName.substring(0, 15),
				formattedData = {
					user: $.extend(true, {}, {
						caller_id: {
							internal: {
								name: callerIdName,
								number: data.callflow.extension
							}
						},
						presence_id: data.callflow.extension,
						email: data.extra.differentEmail ? data.extra.email : data.user.username,
						priv_level: 'user'
					}, data.user),
					vmbox: {
						mailbox: data.callflow.extension,
						name: fullName + '\'s VMBox'
					},
					callflow: {
						contact_list: {
							exclude: false
						},
						flow: {
							children: {
								_: {
									children: {},
									data: {},
									module: 'voicemail'
								}
							},
							data: {
								can_call_self: false,
								timeout: 20
							},
							module: 'user'
						},
						name: fullName + ' SmartPBX\'s Callflow',
						numbers: [ (data.callflow || {}).extension ]
					},
					extra: data.extra
				};

			return formattedData;
		},

		/* Utils */
		usersDelete: function(userId, removeDevices, removeConferences, callback) {
			var self = this;

			monster.parallel({
					devices: function(callback) {
						self.usersListDeviceUser(userId, function(devices) {
							callback(null, devices);
						});
					},
					vmbox: function(callback) {
						self.usersListVMBoxesUser(userId, function(data) {
							callback(null, data);
						});
					},
					callflows: function(callback) {
						self.usersListCallflowsUser(userId, function(data) {
							callback(null, data);
						});
					},
					conferences: function(callback) {
						self.usersListConferences(userId, function(data) {
							callback(null, data);
						});
					}
				},
				function(error, results) {
					var listFnDelete = [];

					_.each(results.devices, function(device) {
						listFnDelete.push(function(callback) {
							if(removeDevices) {
								self.usersDeleteDevice(device.id, function(data) {
									callback(null, '');
								});
							}
							else {
								self.usersUnassignDevice(device.id, function(data) {
									callback(null, '');
								});
							}
						});
					});

					listFnDelete.push(function(callback) {
						self.usersRemoveBulkConferences(results.conferences, removeConferences, function() {
							callback(null, '');
						});
					});

					_.each(results.callflows, function(callflow) {

						/*
						Special case for users with mobile devices:
						reassign mobile devices to their respective mobile callflow instead of just deleting the callflow
						 */
						if (callflow.type === 'mobile') {
							listFnDelete.push(function(mainCallback) {
								monster.parallel({
										callflow: function(callback) {
											self.usersGetCallflow(callflow.id, function(data) {
												callback(null, data);
											});
										},
										mobileDevice: function(callback) {
											self.usersGetMobileDevice(callflow.numbers[0].slice(2), function(data) {
												callback(null, data);
											});
										}
									},
									function(err, results) {
										var fullCallflow = results.callflow,
											mobileDeviceId = results.mobileDevice.id;

										delete fullCallflow.owner_id;

										$.extend(true, fullCallflow, {
											flow: {
												module: 'device',
												data: {
													id: mobileDeviceId
												}
											}
										});

										self.usersUpdateCallflow(fullCallflow, function(data) {
											mainCallback(null, data);
										});
									}
								);
							});
						}
						else {
							listFnDelete.push(function(callback) {
								self.usersDeleteCallflow(callflow.id, function(data) {
									callback(null, '');
								});
							});
						}
					});

					_.each(results.vmbox, function(vmbox) {
						listFnDelete.push(function(callback) {
							self.usersDeleteVMBox(vmbox.id, function(data) {
								callback(null, '');
							});
						});
					});

					monster.parallel(listFnDelete, function(err, resultsDelete) {
						self.usersDeleteUser(userId, function(data) {
							callback && callback(data);
						});
					});
				}
			);
		},

		usersGetCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		usersGetMobileDevice: function(mdn, callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					data: {
						filters: {
							'filter_mobile.mdn': mdn
						}
					}
				},
				success: function(data, status) {
					callback(data.data);
				}
			});
		},

		usersDeleteUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'user.delete',
				data: {
					userId: userId,
					accountId: self.accountId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersDeleteVMBox: function(vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.delete',
				data: {
					voicemailId: vmboxId,
					accountId: self.accountId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersUnassignDevice: function(deviceId, callback) {
			var self = this;

			self.usersGetDevice(deviceId, function(deviceGet) {
				delete deviceGet.owner_id;

				self.usersUpdateDevice(deviceGet, function(updatedDevice) {
					callback && callback(updatedDevice);
				});
			});
		},

		usersDeleteDevice: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.delete',
				data: {
					deviceId: deviceId,
					accountId: self.accountId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},
		usersDeleteCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.delete',
				data: {
					callflowId: callflowId,
					accountId: self.accountId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'user.create',
				data: {
					accountId: self.accountId,
					data: data.user
				},
				success: function(_dataUser) {
					var userId = _dataUser.data.id;
					data.user.id = userId;
					data.vmbox.owner_id = userId;

					self.usersCreateVMBox(data.vmbox, function(_dataVM) {
						data.callflow.owner_id = userId;
						data.callflow.type = 'mainUserCallflow';
						data.callflow.flow.data.id = userId;
						data.callflow.flow.children['_'].data.id = _dataVM.id;

						self.usersCreateCallflow(data.callflow, function(_dataCF) {
							if(data.extra.includeInDirectory) {
								self.usersAddUserToMainDirectory(_dataUser.data, _dataCF.id, function(dataDirectory) {
									callback(data);
								});
							}
							else {
								callback(data);
							}
						});
					});
				}
			});
		},

		/* Hack to support users from previous version */
		usersMigrateFromExtensions: function(userId, listExtensions, callback) {
			var self = this;

			self.usersGetUser(userId, function(user) {
				user.extra = {
					vmbox: {
						mailbox: listExtensions[0]
					}
				};

				var fullName = user.first_name + ' ' + user.last_name,
					callflow = {
						contact_list: {
							exclude: false
						},
						flow: {
							children: {
								_: {
									children: {},
									data: {
									},
									module: 'voicemail'
								}
							},
							data: {
								id: user.id,
								can_call_self: false,
								timeout: 20
							},
							module: 'user'
						},
						name: fullName + ' SmartPBX\'s Callflow',
						numbers: listExtensions,
						owner_id: user.id,
						type: 'mainUserCallflow'
					};

				self.usersSmartUpdateVMBox({
					user: user,
					needVMUpdate: false,
					callback: function(_dataVM) {
						callflow.flow.children['_'].data.id = _dataVM.id;

						self.usersCreateCallflow(callflow,
							function(_dataCF) {
								callback && callback(_dataCF);
							},
							function(errorPayload, globalHandler) {
								var errorCallback = function() {
									globalHandler && globalHandler(errorPayload, { generateError: true });
								};

								if(errorPayload.error === '400' && errorPayload.hasOwnProperty('data') && errorPayload.data.hasOwnProperty('numbers') && errorPayload.data.numbers.hasOwnProperty('unique')) {
									self.usersHasKazooUICallflow(callflow, function(existingCallflow) {
										self.usersMigrateKazooUIUser(callflow, existingCallflow, callback);
									}, errorCallback);
								}
								else {
									errorCallback();
								}
							},
							false
						);
					}
				});
			});
		},

		usersGetCallflowFromNumber: function(number, callback) {
			var self = this,
				found = false;

			self.callApi({
				resource: 'callflow.searchByNumber',
				data: {
					accountId: self.accountId,
					value: number
				},
				success: function(results) {
					if(results.data.length > 0) {
						_.each(results.data, function(callflow) {
							_.each(callflow.numbers, function(n) {
								if(n === number && found === false) {
									found = true;

									self.callApi({
										resource: 'callflow.get',
										data: {
											accountId: self.accountId,
											callflowId: callflow.id
										},
										success: function(callflow) {
											callback && callback(callflow.data);
										}
									})
								}
							});
						});

						if(found === false) {
							callback && callback({});
						}
					}
					else {
						callback && callback({});
					}
				}
			});
		},

		usersHasKazooUICallflow: function(callflow, success, error) {
			var self = this,
				parallelRequests = {},
				kazooUICallflowFound = 0,
				kazooUICallflow;

			// Check if we find a number that belong to a Kazoo-UI callflow
			_.each(callflow.numbers, function(number) {
				parallelRequests[number] = function(callback) {
					self.usersGetCallflowFromNumber(number, function(callflow) {
						if(!(callflow.hasOwnProperty('ui_metadata') && callflow.ui_metadata.hasOwnProperty('ui') && callflow.ui_metadata.ui === 'monster-ui')) {
							// If we already found a callflow
							if(typeof kazooUICallflow !== 'undefined') {
								// If it's not the same Callflow that we found before, we increment the # of callflows found, which will trigger an error later
								// If it's the same as before we do nothing
								if(callflow.id !== kazooUICallflow.id) {
									kazooUICallflowFound++;
								}
							}
							else {
								kazooUICallflowFound++;
								kazooUICallflow = callflow;
							}
						}

						callback && callback(null, {});
					});
				}
			});

			
			monster.parallel(parallelRequests, function(err, results) {
				// If we didn't find a single non-Monster-UI Callflow, then we trigger the error
				if(kazooUICallflowFound === 0) {
					error && error();
				}
				// If we had more than 1 Kazoo UI callflow, show an error saying the migration is impossible
				else if(kazooUICallflowFound > 1) {
					monster.ui.alert(self.i18n.active().users.migration.tooManyCallflows);
				}
				// Else, we have found 1 callflow from Kazoo-UI, migration is possible, we continue with the success callback
				else {
					success && success(kazooUICallflow);
				}
			});
		},

		usersMigrateKazooUIUser: function(callflowToCreate, existingCallflow, callback) {
			var self = this,
				newNumbers = [];

			// copy all the existing callflow numbers to the callflow we're about to create
			callflowToCreate.numbers = existingCallflow.numbers;

			// Update the numbers of the existing callflow so that we keep a trace of the migration
			_.each(existingCallflow.numbers, function(number) {
				newNumbers.push('old_' + number + '_r' + monster.util.randomString(6));
			});
			existingCallflow.numbers = newNumbers;

			// Make sure the User knows what's going to happen
			monster.ui.confirm(self.i18n.active().users.migration.confirmMigration, function() {
				// First update the existing callflow with its new fake numbers
				self.usersUpdateCallflow(existingCallflow, function(oldCallflow) {
					// Now that the numbers have been changed, we can create the new Monster UI Callflow
					self.usersCreateCallflow(callflowToCreate, function(newCallflow) {
						// Once all this is done, continue normally to the SmartPBX normal update
						callback && callback(newCallflow);
					})
				});
			});
		},

		usersAddUserToMainDirectory: function(dataUser, callflowId, callback) {
			var self = this;

			self.usersGetMainDirectory(function(directory) {
				dataUser.directories = dataUser.directories || {};
				dataUser.directories[directory.id] = callflowId;

				self.usersUpdateUser(dataUser, function(data) {
					callback && callback(data);
				});
			});
		},

		usersGetMainCallflow: function(userId, callback) {
			var self = this;

			self.usersListCallflowsUser(userId, function(listCallflows) {
				var indexMain = -1;

				_.each(listCallflows, function(callflow, index) {
					if(callflow.owner_id === userId && callflow.type === 'mainUserCallflow' || !('type' in callflow)) {
						indexMain = index;
						return false;
					}
				});

				if(indexMain === -1) {
					//toastr.error(self.i18n.active().users.noUserCallflow);
					callback(null);
				}
				else {
					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: listCallflows[indexMain].id
						},
						success: function(data) {
							callback(data.data);
						},
						error: function() {
							callback(listCallflows[indexMain]);
						}
					});
				}
			});
		},

		usersSearchMobileCallflowsByNumber: function (userId, phoneNumber, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.searchByNumber',
				data: {
					accountId: self.accountId,
					value: encodeURIComponent('+1' + phoneNumber),
					filter_owner_id: userId,
					filter_type: 'mobile'
				},
				success: function(data) {
					callback(data.data[0]);
				}
			});
		},

		usersGetMainDirectory: function(callback) {
			var self = this;

			self.usersListDirectories(function(listDirectories) {
				var indexMain = -1;

				_.each(listDirectories, function(directory, index) {
					if(directory.name === 'SmartPBX Directory') {
						indexMain = index;

						return false;
					}
				});

				if(indexMain === -1) {
					self.usersCreateMainDirectory(function(data) {
						callback(data);
					});
				}
				else {
					callback(listDirectories[indexMain]);
				}
			});
		},

		usersListDirectories: function(callback) {
			var self = this;

			self.callApi({
				resource: 'directory.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersCreateMainDirectory: function(callback) {
			var self = this,
				dataDirectory = {
					confirm_match: false,
					max_dtmf: 0,
					min_dtmf: 3,
					name: 'SmartPBX Directory',
					sort_by: 'last_name'
				};

			self.callApi({
				resource: 'directory.create',
				data: {
					accountId: self.accountId,
					data: dataDirectory
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		usersListCallflows: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListCallflowsUser: function(userId, callback) {
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
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListVMBoxes: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListVMBoxesUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetVMBox: function(vmboxId, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.get',
				data: {
					accountId: self.accountId,
					voicemailId: vmboxId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersCreateVMBox: function(vmData, callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.create',
				data: {
					accountId: self.accountId,
					data: vmData
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersUpdateVMBox: function(vmData, callback) {
			var self = this;

			// VMboxes should not specify any timezone in order to use the user's default.
			delete vmData.timezone;

			self.callApi({
				resource: 'voicemail.update',
				data: {
					accountId: self.accountId,
					data: vmData,
					voicemailId: vmData.id
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'user.get',
				data: {
					accountId: self.accountId,
					userId: userId
				},
				success: function(user) {
					callback && callback(user.data);
				}
			});
		},

		usersUpdateOriginalUser: function(user, callback) {
			var self = this;

			self.usersUpdateUserAPI(user, callback, monster.apps.auth.originalAccount.id);
		},

		usersUpdateUser: function(userData, callback) {
			var self = this;

			userData = self.usersCleanUserData(userData);

			self.usersUpdateUserAPI(userData, callback, self.accountId);
		},

		usersUpdateUserAPI: function(userData, callback, accountId) {
			var self = this;

			self.callApi({
				resource: 'user.update',
				data: {
					accountId: accountId,
					userId: userData.id,
					data: userData
				},
				success: function(userData) {
					callback && callback(userData);
				}
			});
		},

		usersGetConferenceFeature: function(userId, globalCallback) {
			var self = this,
				dataResponse = {
					conference: {},
					listConfNumbers: []
				};

			monster.parallel({
					confNumbers: function(callback) {
						self.usersListConfNumbers(function(numbers) {
							callback && callback(null, numbers);
						});
					},
					listConferences: function(callback) {
						self.usersListConferences(userId, function(conferences) {
							if(conferences.length > 0) {
								self.usersGetConference(conferences[0].id, function(conference) {
									callback && callback(null, conference);
								});
							}
							else {
								callback && callback(null, {});
							}
						});
					}
				},
				function(err, results) {
					dataResponse.conference = results.listConferences;
					dataResponse.listConfNumbers = results.confNumbers;

					globalCallback && globalCallback(dataResponse);
				}
			);
		},

		usersListConfNumbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_type: 'conference',
						paginate: 'false'
					}
				},
				success: function(data) {
					var numbers = [];

					_.each(data.data, function(conf) {
						if(conf.name === 'MainConference') {
							if(conf.numbers.length > 0 && conf.numbers[0] !== 'undefinedconf') {
								numbers = numbers.concat(conf.numbers);
							}
						}
					});

					callback && callback(numbers);
				}
			});
		},

		usersListConferences: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetConference: function(conferenceId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.get',
				data: {
					accountId: self.accountId,
					conferenceId: conferenceId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersUnassignConference: function(conferenceId, callback) {
			var self = this;

			self.usersGetConference(conferenceId, function(conference) {
				conference.name = 'Unassigned ' + conference.name;
				delete conference.owner_id;

				self.usersUpdateConference(conference, function(conference) {
					callback && callback(conference);
				});
			});
		},

		usersUpdateConference: function(conference, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.update',
				data: {
					accountId: self.accountId,
					conferenceId: conference.id,
					data: conference
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersCreateConference: function(conference, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.create',
				data: {
					accountId: self.accountId,
					data: conference
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersDeleteConference: function(conferenceId, callback) {
			var self = this;

			self.callApi({
				resource: 'conference.delete',
				data: {
					accountId: self.accountId,
					conferenceId: conferenceId,
					data: {}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetDevice: function(deviceId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.get',
				data: {
					accountId: self.accountId,
					deviceId: deviceId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersUpdateDevice: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'device.update',
				data: {
					accountId: self.accountId,
					data: data,
					deviceId: data.id
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListDeviceUser: function(userId, callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId,
					filters: {
						filter_owner_id: userId,
						paginate: 'false'
					}
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersListMedias: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback(data.data);
				}
			});
		},

		usersGetData: function(callback) {
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
								callback(null, dataUsers.data);
							}
						});
					},
					callflows: function(callback) {
						self.usersListCallflows(function(callflows) {
							callback(null, callflows);
						});
					},
					devices: function(callback) {
						self.usersGetDevicesData(function(devices) {
							callback(null, devices);
						});
					},
					deviceStatus: function(callback) {
						self.callApi({
							resource: 'device.getStatus',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: 'false'
								}
							},
							success: function(data, status) {
								callback(null, data.data);
							}
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		usersUpdateDevices: function(data, userId, callbackAfterUpdate) {
			var self = this,
				updateDevices = function(userCallflow) {
					var listFnParallel = [],
						updateDeviceRequest = function (newDataDevice, callback) {
							self.usersUpdateDevice(newDataDevice, function (updatedDataDevice) {
								callback(null, updatedDataDevice);
							});
						}

					_.each(data.new, function(deviceId) {
						listFnParallel.push(function(callback) {
							self.usersGetDevice(deviceId, function(data) {
								data.owner_id = userId;

								if (data.device_type === "mobile") {
									self.usersSearchMobileCallflowsByNumber(userId, data.mobile.mdn, function (listCallflowData) {
										self.callApi({
											resource: 'callflow.get',
											data: {
												accountId: self.accountId,
												callflowId: listCallflowData.id
											},
											success: function(rawCallflowData, status) {
												var callflowData = rawCallflowData.data;

												if (userCallflow) {
													$.extend(true, callflowData, {
														owner_id: userId,
														flow: {
															module: 'callflow',
															data: {
																id: userCallflow.id
															}
														}
													});
												}
												else {
													$.extend(true, callflowData, {
														owner_id: userId,
														flow: {
															module: 'device',
															data: {
																id: deviceId
															}
														}
													});
												}

												self.usersUpdateCallflow(callflowData, function () {
													updateDeviceRequest(data, callback);
												});
											}
										});
									});
								}
								else {
									updateDeviceRequest(data, callback);
								}
							});
						});
					});

					_.each(data.old, function(deviceId) {
						listFnParallel.push(function(callback) {
							self.usersGetDevice(deviceId, function(data) {
								delete data.owner_id;

								if (data.device_type === 'mobile') {
									self.usersSearchMobileCallflowsByNumber(userId, data.mobile.mdn, function (listCallflowData) {
										self.callApi({
											resource: 'callflow.get',
											data: {
												accountId: self.accountId,
												callflowId: listCallflowData.id
											},
											success: function(rawCallflowData, status) {
												var callflowData = rawCallflowData.data;

												delete callflowData.owner_id;
												$.extend(true, callflowData, {
													flow: {
														module: 'device',
														data: {
															id: deviceId
														}
													}
												});

												self.usersUpdateCallflow(callflowData, function () {
													updateDeviceRequest(data, callback);
												});
											}
										});
									});
								}
								else {
									updateDeviceRequest(data, callback);
								}
							});
						});
					});

					if(data.old.length > 0 && userCallflow && userCallflow.flow.module === 'ring_group') {
						var endpointsCount = userCallflow.flow.data.endpoints.length;
						userCallflow.flow.data.endpoints =_.filter(userCallflow.flow.data.endpoints, function(endpoint) {
							return (data.old.indexOf(endpoint.id) < 0);
						});
						if(userCallflow.flow.data.endpoints.length < endpointsCount) {
							if(userCallflow.flow.data.endpoints.length === 0) {
								userCallflow.flow.module = 'user';
								userCallflow.flow.data = {
									can_call_self: false,
									id: userId,
									timeout: "20"
								}
								listFnParallel.push(function(callback) {
									self.usersGetUser(userId, function(user) {
										user.smartpbx.find_me_follow_me.enabled = false;
										self.usersUpdateUser(user, function(data) {
											callback(null, data)
										});
									});
								});
							}
							listFnParallel.push(function(callback) {
								self.usersUpdateCallflow(userCallflow, function(data) {
									callback(null, data);
								});
							});
						}
					}

					monster.parallel(listFnParallel, function(err, results) {
						callbackAfterUpdate && callbackAfterUpdate(results);
					});
				};

			self.usersGetMainCallflow(userId, function(callflow) {
				updateDevices(callflow)
			});
		},

		usersUpdateCallflowNumbers: function(userId, callflowId, numbers, callback) {
			var self = this;

			if(numbers.length > 0) {
				if(callflowId) {
					self.callApi({
						resource: 'callflow.get',
						data: {
							accountId: self.accountId,
							callflowId: callflowId
						},
						success: function(getCallflowData) {
							getCallflowData.data.numbers = numbers;

							self.usersUpdateCallflow(getCallflowData.data, function(callflowData) {
								callback && callback(callflowData);
							});
						}
					});
				}
				else {
					if(numbers[0].length < 7) {
						self.usersMigrateFromExtensions(userId, numbers, function(data) {
							callback && callback(data);
						});
					}
					else {
						toastr.error(self.i18n.active().users.needExtensionFirst);
					}
				}
			}
			else {
				toastr.error(self.i18n.active().users.noNumberCallflow);
			}
		},

		usersListNumbers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'numbers.list',
				data: {
					accountId: self.accountId,
					filters: {
						paginate: 'false'
					}
				},
				success: function(numbers) {
					callback && callback(numbers.data);
				}
			});
		},

		usersUpdateCallflow: function(callflow, callback) {
			var self = this;

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
		},

		usersCreateCallflow: function(callflow, success, error, generateError) {
			var self = this;

			self.callApi({
				resource: 'callflow.create',
				data: {
					accountId: self.accountId,
					data: callflow,
					generateError: generateError === false ? false : true
				},
				success: function(callflowData) {
					success && success(callflowData.data);
				},
				error: function(callflowData, junk, globalHandler) {
					error && error(callflowData, globalHandler);
				}
			});
		},

		/* If user has a vmbox, then only update it if it comes from the user form.
		If the check comes from the extension page, where we create a callflow,
		then only update the vmbox if there are no vmbox attached to this user */
		usersSmartUpdateVMBox: function(args) {
			var self = this,
				user = args.user,
				needVMUpdate = args.needVMUpdate || true,
				callback = args.callback,
				oldPresenceId = args.oldPresenceId || undefined,
				userExtension = args.userExtension;

			self.usersListVMBoxesUser(user.id, function(vmboxes) {
				if(vmboxes.length > 0) {
					if(needVMUpdate) {
						self.usersGetVMBox(vmboxes[0].id, function(vmbox) {
							vmbox.name = user.first_name + ' ' + user.last_name + '\'s VMBox';
							// We only want to update the vmbox number if it was already synced with the presenceId (and if the presenceId was not already set)
							// This allows us to support old clients who have mailbox number != than their extension number
							if(oldPresenceId === vmbox.mailbox) {
								// If it's synced, then we update the vmbox number as long as the main extension is set to something different than 'unset' in which case we don't update the vmbox number value
								vmbox.mailbox = (user.presence_id && user.presence_id !== 'unset') ? user.presence_id + '' : vmbox.mailbox;
							}

							self.usersUpdateVMBox(vmbox, function(vmboxSaved) {
								callback && callback(vmboxSaved);
							});
						});
					}
					else {
						callback && callback(vmboxes[0]);
					}
				}
				else {
					var vmbox = {
						owner_id: user.id,
						mailbox: user.presence_id || userExtension || user.extra.vmbox.mailbox,
						name: user.first_name + ' ' + user.last_name + '\'s VMBox'
					};

					self.usersCreateVMBox(vmbox, function(vmbox) {
						callback && callback(vmbox);
					});
				}
			});
		},

		usersUpdateConferencing: function(data, globalCallback) {
			var self = this;

			monster.parallel({
					conference: function(callback) {
						var baseConference = {
							name: data.user.first_name + ' ' + data.user.last_name + ' SmartPBX Conference',
							owner_id: data.user.id,
							play_name_on_join: true,
							member: {
								join_muted: false
							},
							conference_numbers: []
						};

						monster.util.dataFlags.add({ source: 'smartpbx'}, baseConference);

						baseConference = $.extend(true, {}, baseConference, data.conference);

						self.usersListConferences(data.user.id, function(conferences) {
							var conferenceToSave = baseConference;
							if(conferences.length > 0) {
								conferenceToSave = $.extend(true, {}, conferences[0], baseConference);

								self.usersUpdateConference(conferenceToSave, function(conference) {
									callback && callback(null, conference);
								});
							}
							else {
								self.usersCreateConference(conferenceToSave, function(conference) {
									callback && callback(null, conference);
								});
							}
						});
					},
					user: function(callback) {
						if(data.user.smartpbx && data.user.smartpbx.conferencing && data.user.smartpbx.conferencing.enabled === true) {
							callback && callback(null, data.user);
						}
						else {
							data.user.smartpbx = data.user.smartpbx || {};
							data.user.smartpbx.conferencing = data.user.smartpbx.conferencing || {};

							data.user.smartpbx.conferencing.enabled = true;

							self.usersUpdateUser(data.user, function(user) {
								callback && callback(null, user.data);
							});
						}
					}
				},
				function(err, results) {
					globalCallback && globalCallback(results);
				}
			);
		},

		usersUpdateFaxing: function(data, newNumber, globalCallback) {
			var self = this;

			monster.parallel({
					callflow: function(callback) {
						var baseCallflow = {};

						self.usersListCallflowsUser(data.user.id, function(callflows) {
							_.each(callflows, function(callflow) {
								if(callflow.type === 'faxing') {
									baseCallflow.id = callflow.id;

									return false;
								}
							});

							self.usersUpdateCallflowFaxing(data, newNumber, baseCallflow, function(callflow) {
								callback && callback(null, callflow);
							});
						});
					},
					user: function(callback) {
						if(data.user.smartpbx && data.user.smartpbx.faxing && data.user.smartpbx.faxing.enabled === true) {
							callback && callback(null, data.user);
						}
						else {
							data.user.smartpbx = data.user.smartpbx || {};
							data.user.smartpbx.faxing = data.user.smartpbx.faxing || {};

							data.user.smartpbx.faxing.enabled = true;

							self.usersUpdateUser(data.user, function(user) {
								callback && callback(null, user.data);
							});
						}
					}
				},
				function(err, results) {
					globalCallback && globalCallback(results);
				}
			);
		},

		usersUpdateCallflowFaxing: function(data, newNumber, callflow, callback) {
			var self = this,
				user = data.user,
				faxbox = data.faxbox,
				baseCallflow = {
					type: 'faxing',
					owner_id: user.id,
					numbers: [ newNumber ],
					flow: {
						module: 'faxbox',
						children: {},
						data: {
							id: data.hasOwnProperty('faxbox') ? faxbox.id : ''
						}
					}
				},
				number = {
					caller_id: newNumber,
					fax_identity: monster.util.formatPhoneNumber(newNumber)
				};

			callflow = $.extend(true, {}, baseCallflow, callflow);

			if( callflow.hasOwnProperty('id') ) {
				faxbox = $.extend(true, {}, faxbox, number);

				self.callApi({
					resource: 'faxbox.update',
					data:{
						accountId: self.accountId,
						faxboxId: faxbox.id,
						data: faxbox
					},
					success: function(_data, status) {
						self.usersUpdateCallflow(callflow, function(callflow) {
							callback && callback(callflow);
						});
					}
				});
			} else {
				var defaultFaxbox = {
					name: user.first_name.concat(' ', user.last_name, self.i18n.active().users.faxing.defaultSettings.nameExtension),
					caller_name: user.first_name.concat(' ', user.last_name),
					fax_header: monster.config.whitelabel.companyName.concat(self.i18n.active().users.faxing.defaultSettings.headerExtension),
					fax_timezone: user.timezone,
					owner_id: user.id
				};

				faxbox = $.extend(true, {}, defaultFaxbox, number);

				self.callApi({
					resource: 'faxbox.create',
					data: {
						accountId: self.accountId,
						userId: user.id,
						data: faxbox
					},
					success: function(_data, status) {
						callflow.flow.data.id = _data.data.id;

						self.usersCreateCallflow(callflow, function(callflow) {
							callback && callback(callflow);
						});
					}
				});
			}
		},

		usersRemoveBulkConferences: function(conferences, forceDelete, callback) {
			var self = this,
				listRequests = [];

			_.each(conferences, function(conference) {
				listRequests.push(function(subCallback) {
					if(forceDelete) {
						self.usersDeleteConference(conference.id, function(data) {
							subCallback(null, data);
						});
					}
					else {
						self.usersUnassignConference(conference.id, function(data) {
							subCallback(null, data);
						});
					}
				});
			});

			monster.parallel(listRequests, function(err, results) {
				callback && callback(results);
			});
		},

		usersDeleteConferencing: function(userId, globalCallback) {
			var self = this;

			monster.parallel({
					conferences: function(callback) {
						self.usersListConferences(userId, function(conferences) {
							self.usersRemoveBulkConferences(conferences, true, function(results) {
								callback && callback(null, results);
							});
						});
					},
					user: function(callback) {
						self.usersGetUser(userId, function(user) {
							//user.conferencing_enabled = false;
							user.smartpbx = user.smartpbx || {};
							user.smartpbx.conferencing = user.smartpbx.conferencing || {};

							user.smartpbx.conferencing.enabled = false;

							self.usersUpdateUser(user, function(user) {
								callback(null, user);
							});
						});

					}
				},
				function(err, results) {
					globalCallback && globalCallback(results);
				}
			);
		},

		usersDeleteFaxing: function(userId, globalCallback) {
			var self = this;

			monster.parallel({
					callflows: function(callback) {
						self.usersListCallflowsUser(userId, function(callflows) {
							var listRequests = [];

							_.each(callflows, function(callflow) {
								if(callflow.type === 'faxing') {
									listRequests.push(function(subCallback) {
										self.callApi({
											resource: 'callflow.get',
											data: {
												accountId: self.accountId,
												callflowId: callflow.id
											},
											success: function(data, status) {
												self.callApi({
													resource: 'faxbox.delete',
													data: {
														accountId: self.accountId,
														faxboxId: data.data.flow.data.faxbox_id || data.data.flow.data.id,
														generateError: false
													},
													success: function(_data, status) {
														self.usersDeleteCallflow(callflow.id, function(results) {
															subCallback(null, results);
														});
													},
													error: function(_data, error) {
														self.usersDeleteCallflow(callflow.id, function(results) {
															subCallback(null, results);
														});
													}
												});
											}
										});
									});
								}
							});

							monster.parallel(listRequests, function(err, results) {
								callback && callback(results);
							});
						});
					},
					user: function(callback) {
						self.usersGetUser(userId, function(user) {
							//user.faxing_enabled = false;
							user.smartpbx = user.smartpbx || {};
							user.smartpbx.faxing = user.smartpbx.faxing || {};

							user.smartpbx.faxing.enabled = false;

							self.usersUpdateUser(user, function(user) {
								callback(null, user);
							});
						});

					}
				},
				function(err, results) {
					globalCallback && globalCallback(results);
				}
			);
		},

		usersSortExtensions: function(a, b) {
			var parsedA = parseInt(a),
				parsedB = parseInt(b),
				result = -1;

			if(parsedA > 0 && parsedB > 0) {
				result = parsedA > parsedB;
			}

			return result;
		},

		usersRemoveOverlay: function() {
			$('body').find('#users_container_overlay').remove();
		},

		usersResetPassword: function(data, callback) {
			var self = this,
				dataPassword = {
					username: data.username,
					account_name: data.account_name,
					ui_url: window.location.href.split('#')[0]
				};

			self.callApi({
				resource: 'auth.recovery',
				data: {
					data: dataPassword
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		}
	};

	return app;
});
