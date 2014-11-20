define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		timezone = require('monster-timezone'),
		toastr = require('toastr');

	var app = {

		requests: {
		},

		subscribe: {
			'voip.groups.render': 'groupsRender'
		},

		/* Users */
		/* args: parent and groupId */
		groupsRender: function(args) {
			var self = this,
				args = args || {},
				parent = args.parent || $('.right-content'),
				_groupId = args.groupId,
				noGroup = true;

			self.groupsRemoveOverlay();

			self.groupsGetData(function(data) {
				var hasOldData = _.find(data.callflows, function(callflow) {
					return !callflow.hasOwnProperty('type');
				});

				if(hasOldData) {
					monster.ui.alert('error', self.i18n.active().groups.outdatedGroupsError);
				} else {
					var dataTemplate = self.groupsFormatListData(data),
						template = $(monster.template(self, 'groups-layout', { countGroups: Object.keys(dataTemplate.groups).length })),
						templateGroup;

					_.each(dataTemplate.groups, function(group) {
						templateGroup = monster.template(self, 'groups-row', group);

						template.find('.groups-rows').append(templateGroup);
					});

					self.groupsBindEvents(template, parent);

					parent
						.empty()
						.append(template);
						
					if(_groupId) {
						var cells =  parent.find('.grid-row[data-id=' + _groupId + '] .grid-cell');

						monster.ui.hightlight(cells);
					}

					for (var group in dataTemplate.groups) {
						noGroup = ( typeof dataTemplate.groups[group] === 'undefined' ) ? true : false;
					}

					if ( noGroup ) {
						parent.find('.grid-row.title').css('display', 'none');
						parent.find('.no-groups-row').css('display', 'block');
					} else {
						parent.find('.grid-row.title').css('display', 'block');
						parent.find('.no-groups-row').css('display', 'none');
					}
				}
			});
		},

		groupsFormatListData: function(data) {
			var self = this,
				mapGroups = {};

			_.each(data.groups, function(group) {
				mapGroups[group.id] = group;

				mapGroups[group.id].extra = self.groupsGetGroupFeatures(group);
			});

			_.each(data.callflows, function(callflow) {
				if(callflow.group_id in mapGroups) {
					if(callflow.type === 'userGroup') {
						var listExtensions = [],
							listNumbers = [];

						_.each(callflow.numbers, function(number) {
							number.length < 7 ? listExtensions.push(number) : listNumbers.push(number);
						});

						mapGroups[callflow.group_id].extra.listCallerId = [];

						if(listExtensions.length > 0) {
							mapGroups[callflow.group_id].extra.extension = listExtensions[0];

							_.each(listExtensions, function(number) {
								mapGroups[callflow.group_id].extra.listCallerId.push(number);
							});
						}
						mapGroups[callflow.group_id].extra.additionalExtensions = listExtensions.length > 1;

						if(listNumbers.length > 0) {
							mapGroups[callflow.group_id].extra.mainNumber = listNumbers[0];

							_.each(listNumbers, function(number) {
								mapGroups[callflow.group_id].extra.listCallerId.push(number);
							});
						}
						mapGroups[callflow.group_id].extra.additionalNumbers = listNumbers.length > 1;
						mapGroups[callflow.group_id].extra.callflowId = callflow.id;
					} else if(callflow.type === 'baseGroup') {
						mapGroups[callflow.group_id].extra.baseCallflowId = callflow.id;
					}
				}
			});

			data.groups = mapGroups;

			return data;
		},

		groupsGetGroupFeatures: function(group) {
			var self = this,
				result = {
					mapFeatures: {
						call_recording: {
							icon: 'icon-microphone',
							iconColor: 'icon-blue',
							title: self.i18n.active().groups.callRecording.title
						},
						ringback: {
							icon: 'icon-music',
							iconColor: 'icon-yellow',
							title: self.i18n.active().groups.ringback.title
						},
						next_action: {
							icon: 'icon-share-alt',
							iconColor: 'icon-green',
							title: self.i18n.active().groups.nextAction.title
						}
					},
					hasFeatures: false
				};

			_.each(result.mapFeatures, function(val, key) {
				if(('features' in group && group.features.indexOf(key) >= 0) // If data from view
				|| ('smartpbx' in group && key in group.smartpbx && group.smartpbx[key].enabled)) { // If data from document
					val.active = true;
					result.hasFeatures = true;
				}
			});

			return result;
		},

		groupsBindEvents: function(template, parent) {
			var self = this;

			template.find('.grid-row:not(.title) .grid-cell').on('click', function() {
				var cell = $(this),
					type = cell.data('type'),
					row = cell.parents('.grid-row'),
					groupId = row.data('id');

				template.find('.edit-groups').slideUp("400", function() {
					$(this).empty();
				});

				if(cell.hasClass('active')) {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');

					self.groupsRemoveOverlay();
					cell.css({
						'position': 'inline-block',
						'z-index': '0'
					});

					cell.parent().siblings('.edit-groups').css({
						'position': 'block',
						'z-index': '0'
					});
				}
				else {
					template.find('.grid-cell').removeClass('active');
					template.find('.grid-row').removeClass('active');
					cell.toggleClass('active');
					row.toggleClass('active');

					cell.css({
						'position': 'relative',
						'z-index': '3'
					});

					cell.parent().siblings('.edit-groups').css({
						'position': 'relative',
						'z-index': '2'
					});

					self.groupsGetTemplate(type, groupId, function(template, data) {
						//FancyCheckboxes.
						monster.ui.prettyCheck.create(template);

						row.find('.edit-groups').append(template).slideDown();

						$('body').append($('<div id="groups_container_overlay"></div>'));
					});
				}
			});

			template.find('.groups-header .search-query').on('keyup', function() {
				var searchString = $(this).val().toLowerCase(),
					rows = template.find('.groups-rows .grid-row:not(.title)'),
					emptySearch = template.find('.groups-rows .empty-search-row');

				_.each(rows, function(row) {
					var row = $(row);

					row.data('search').toLowerCase().indexOf(searchString) < 0 ? row.hide() : row.show();
				});

				if(rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.on('click', '.cancel-link', function() {
				template.find('.edit-groups').slideUp("400", function() {
					$(this).empty();
					template.find('.grid-cell.active').css({
						'position': 'inline-block',
						'z-index': '0'
					});
					template.find('.grid-row.active .edit-groups').css({
						'position': 'block',
						'z-index': '0'
					});
					template.find('.grid-row.active').removeClass('active');
					self.groupsRemoveOverlay();

					template.find('.grid-cell.active').removeClass('active');
				});
			});

			template.find('.groups-header .add-group').on('click', function() {
				self.groupsGetCreationData(function(data) {
					var groupTemplate = $(monster.template(self, 'groups-creation', data)),
						groupForm = groupTemplate.find('#form_group_creation');

					monster.ui.validate(groupForm);

					groupTemplate.find('#create_group').on('click', function() {
						var formattedData = self.groupsCreationMergeData(data, groupTemplate);
						if(monster.ui.valid(groupForm)) {
							self.groupsCreate(formattedData, function(data) {
								popup.dialog('close').remove();

								self.groupsRender({ groupId: data.id });
							});
						}
					});

					groupTemplate.find('#group_user_selector .selected-users, #group_user_selector .available-users').sortable({
						connectWith: '.connectedSortable'
					}).disableSelection();

					var popup = monster.ui.dialog(groupTemplate, {
						title: self.i18n.active().groups.dialogCreationGroup.title
					});
				});
			});

			$('body').on('click', '#groups_container_overlay', function() {
				template.find('.edit-groups').slideUp("400", function() {
					$(this).empty();
				});

				self.groupsRemoveOverlay();

				template.find('.grid-cell.active').css({
					'position': 'inline-block',
					'z-index': '0'
				});

				template.find('.grid-row.active').parent().siblings('.edit-groups').css({
					'position': 'block',
					'z-index': '0'
				});

				template.find('.grid-cell.active').removeClass('active');
				template.find('.grid-row.active').removeClass('active');
			});
		},

		groupsCreationMergeData: function(data, template) {
			var formData = form2object('form_group_creation'),
				fixedTimeout = '20',
				fixedDelay = '0',
				settings = {
					timeout: fixedTimeout,
					delay: fixedDelay,
					endpoint_type: 'user'
				},
				listUserRingGroup = [],
				listUserGroup = {};

			template.find('.selected-users li').each(function() {
				var userId = $(this).data('user_id'),
					ringGroupUser = $.extend(true, {}, settings, { id: userId });

				listUserGroup[userId] = { type: 'user' };
				listUserRingGroup.push(ringGroupUser);
			});

			var formattedData = {
				group: {
					name: formData.name,
					endpoints: listUserGroup
				},
				baseCallflow: {
					numbers: [ monster.util.randomString(25) ],
					name: formData.name + ' Base Group',
					flow: {
						module: 'ring_group',
						children: {},
						data: {
							strategy: 'simultaneous',
							timeout: parseInt(fixedTimeout) + parseInt(fixedDelay),
							endpoints: listUserRingGroup
						}
					},
					type: 'baseGroup'
				},
				callflow: {
					numbers: [ formData.extra.extension ],
					name: formData.name + ' Ring Group',
					flow: {
						module: 'callflow',
						children: {},
						data: {
							id: ''
						}
					},
					type: 'userGroup'
				}
			};

			return formattedData;
		},

		groupsGetTemplate: function(type, groupId, callbackAfterData) {
			var self = this,
				template;

			if(type === 'name') {
				self.groupsGetNameTemplate(groupId, callbackAfterData);
			}
			else if(type === 'numbers') {
				self.groupsGetNumbersTemplate(groupId, callbackAfterData);
			}
			else if(type === 'extensions') {
				self.groupsGetExtensionsTemplate(groupId, callbackAfterData);
			}
			else if(type === 'features') {
				self.groupsGetFeaturesTemplate(groupId, callbackAfterData);
			}
			else if(type === 'members') {
				self.groupsGetMembersTemplate(groupId, callbackAfterData);
			}
		},

		groupsGetFeaturesTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetFeaturesData(groupId, function(data) {
				template = $(monster.template(self, 'groups-features', data.group));

				self.groupsBindFeatures(template, data);

				callback && callback(template, data);
			});
		},

		groupsGetNameTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetNameData(groupId, function(data) {
				template = $(monster.template(self, 'groups-name', data));

				self.groupsBindName(template, data);

				callback && callback(template, data);
			});
		},

		groupsGetNumbersTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetNumbersData(groupId, function(data) {
				self.groupsFormatNumbersData(data, function(data) {
					template = $(monster.template(self, 'groups-numbers', data));

					self.groupsBindNumbers(template, data);

					callback && callback(template, data);
				});
			});
		},

		groupsGetExtensionsTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetNumbersData(groupId, function(data) {
				self.groupsFormatNumbersData(data, function(data) {
					template = $(monster.template(self, 'groups-extensions', data));

					self.groupsBindExtensions(template, data);

					callback && callback(template, data);
				});
			});
		},

		groupsGetMembersTemplate: function(groupId, callback) {
			var self = this;

			self.groupsGetMembersData(groupId, function(results) {
				var results = self.groupsFormatMembersData(results);

				template = $(monster.template(self, 'groups-members', results));
				
				self.groupsRenderMemberSliders(template, results.extra.ringGroup);

				self.groupsBindMembers(template, results);

				template.find('.grid-time').sortable({
					items: '.group-row:not(.title)',
					placeholder: 'group-row-placeholder'
				});

				template.find('[data-toggle="tooltip"]').tooltip();

				callback && callback(template, results);
			});
		},

		groupsBindFeatures: function(template, data) {
			var self = this;

			template.find('.feature[data-feature="call_recording"]').on('click', function() {
				self.groupsRenderCallRecording(data);
			});

			template.find('.feature[data-feature="ringback"]').on('click', function() {
				self.groupsRenderRingback(data);
			});

			template.find('.feature[data-feature="next_action"]').on('click', function() {
				self.groupsRenderNextAction(data);
			});
		},

		groupsRenderCallRecording: function(data) {
			var self = this,
				templateData = $.extend(true, {
												group: data.group
											},
											(data.group.extra.mapFeatures.call_recording.active ? {
												url: data.callflow.flow.data.url,
												format: data.callflow.flow.data.format,
												timeLimit: data.callflow.flow.data.time_limit
											} : {})
										),
				featureTemplate = $(monster.template(self, 'groups-feature-call_recording', templateData)),
				switchFeature = featureTemplate.find('.switch').bootstrapSwitch(),
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

			switchFeature.on('switch-change', function(e, data) {
				data.value ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				if(monster.ui.valid(featureForm)) {
					var formData = form2object('call_recording_form'),
						enabled = switchFeature.bootstrapSwitch('status');

					if(!('smartpbx' in data.group)) { data.group.smartpbx = {}; }
					if(!('call_recording' in data.group.smartpbx)) {
						data.group.smartpbx.call_recording = {
							enabled: false
						};
					}

					if(data.group.smartpbx.call_recording.enabled || enabled) {
						data.group.smartpbx.call_recording.enabled = enabled;
						var newCallflow = $.extend(true, {}, data.callflow);
						if(enabled) {
							if(newCallflow.flow.module === 'record_call') {
								newCallflow.flow.data = $.extend(true, { action: "start" }, formData);
							} else {
								newCallflow.flow = {
									children: {
										"_": $.extend(true, {}, data.callflow.flow)
									},
									module: "record_call",
									data: $.extend(true, { action: "start" }, formData)
								}
							}
						} else {
							newCallflow.flow = $.extend(true, {}, data.callflow.flow.children["_"]);
						}
						self.groupsUpdateCallflow(newCallflow, function(updatedCallflow) {
							self.groupsUpdate(data.group, function(updatedGroup) {
								popup.dialog('close').remove();
								self.groupsRender({ groupId: data.group.id });
							});
						});
					} else {
						popup.dialog('close').remove();
						self.groupsRender({ groupId: data.group.id });
					}
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: data.group.extra.mapFeatures.call_recording.title,
				position: ['center', 20]
			});
		},

		groupsRenderRingback: function(data) {
			var self = this,
				silenceMediaId = 'silence_stream://300000',
				ringGroupNode = data.callflow.flow;

			while(ringGroupNode.module !== 'ring_group' && '_' in ringGroupNode.children) {
				ringGroupNode = ringGroupNode.children['_'];
			}

			self.groupsListMedias(function(medias) {
				var templateData = {
						group: data.group,
						silenceMedia: silenceMediaId,
						mediaList: medias,
						media: ringGroupNode.data.ringback || ''
					},
					featureTemplate = $(monster.template(self, 'groups-feature-ringback', templateData)),
					switchFeature = featureTemplate.find('.switch').bootstrapSwitch(),
					popup,
					closeUploadDiv = function(newMedia) {
						var uploadInput = featureTemplate.find('.upload-input');
						uploadInput.wrap('<form>').closest('form').get(0).reset();
						uploadInput.unwrap();
						featureTemplate.find('.upload-div').slideUp(function() {
							featureTemplate.find('.upload-toggle').removeClass('active');
						});
						if(newMedia) {
							var mediaSelect = featureTemplate.find('.media-dropdown');
							mediaSelect.append('<option value="'+newMedia.id+'">'+newMedia.name+'</option>');
							mediaSelect.val(newMedia.id);
						}
					};

				featureTemplate.find('.cancel-link').on('click', function() {
					popup.dialog('close').remove();
				});

				switchFeature.on('switch-change', function(e, data) {
					data.value ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
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
					var file = featureTemplate.find('.upload-input')[0].files[0];
						fileReader = new FileReader();

					fileReader.onloadend = function(evt) {
						self.callApi({
							resource: 'media.create',
							data: {
								accountId: self.accountId,
								data: {
									streamable: true,
									name: file.name,
									media_source: "upload",
									description: file.name
								}
							},
							success: function(data, status) {
								var media = data.data;
								self.callApi({
									resource: 'media.upload',
									data: {
										accountId: self.accountId,
										mediaId: media.id,
										data: evt.target.result
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
											success: function(data, status) {

											}
										});
									}
								});
							}
						});
					};

					if(file) {
						if(file.size >= (Math.pow(2,20) * 5)) { //If size bigger than 5MB
							monster.ui.alert(self.i18n.active().groups.ringback.fileTooBigAlert);
						} else {
							fileReader.readAsDataURL(file);
						}
					} else {
						monster.ui.alert(self.i18n.active().groups.ringback.emptyUploadAlert);
					}
				});

				featureTemplate.find('.save').on('click', function() {
					var selectedMedia = featureTemplate.find('.media-dropdown option:selected').val(),
						enabled = switchFeature.bootstrapSwitch('status');

					if(!('smartpbx' in data.group)) {
						data.group.smartpbx = {};
					}

					if(enabled) {
						ringGroupNode.data.ringback = selectedMedia;
						if('ringback' in data.group.smartpbx) {
							data.group.smartpbx.ringback.enabled = true;
						} else {
							data.group.smartpbx.ringback = {
								enabled: true
							};
						}

						self.groupsUpdateCallflow(data.callflow, function() {
							self.groupsUpdate(data.group, function(updatedGroup) {
								popup.dialog('close').remove();
								self.groupsRender({ groupId: data.group.id });
							});
						});
					} else if(ringGroupNode.data.ringback || (data.group.smartpbx.ringback && data.group.smartpbx.ringback.enabled)) {
						delete ringGroupNode.data.ringback;
						if('ringback' in data.group.smartpbx) {
							data.group.smartpbx.ringback.enabled = false;
						}

						self.groupsUpdateCallflow(data.callflow, function() {
							self.groupsUpdate(data.group, function(updatedGroup) {
								popup.dialog('close').remove();
								self.groupsRender({ groupId: data.group.id });
							});
						});
					}
				});

				popup = monster.ui.dialog(featureTemplate, {
					title: data.group.extra.mapFeatures.ringback.title,
					position: ['center', 20]
				});
			});
		},

		groupsRenderNextAction: function(data) {
			var self = this,
				flow = data.callflow.flow,
				selectedEntity = null;

			while(flow.module != 'callflow') {
				flow = flow.children['_']; 
			} //Go to the first callflow (i.e. base ring group)
			if('_' in flow.children) {
				selectedEntity = flow.children['_'].data.id;
			} //Find the existing Next Action if there is one


			var templateData = $.extend(true, {selectedEntity: selectedEntity}, data),
				featureTemplate = $(monster.template(self, 'groups-feature-next_action', templateData)),
				switchFeature = featureTemplate.find('.switch').bootstrapSwitch(),
				popup;

			featureTemplate.find('.cancel-link').on('click', function() {
				popup.dialog('close').remove();
			});

			switchFeature.on('switch-change', function(e, data) {
				data.value ? featureTemplate.find('.content').slideDown() : featureTemplate.find('.content').slideUp();
			});

			featureTemplate.find('.save').on('click', function() {
				var selectedOption = featureTemplate.find('.next-action-select option:selected'),
					enabled = switchFeature.bootstrapSwitch('status');

				if(!('smartpbx' in data.group)) { data.group.smartpbx = {}; }
				if(!('next_action' in data.group.smartpbx)) {
					data.group.smartpbx.next_action = {
						enabled: false
					};
				}

				if(data.group.smartpbx.next_action.enabled || enabled) {
					data.group.smartpbx.next_action.enabled = enabled;
					var newCallflow = $.extend(true, {}, data.callflow),
						newFlow = newCallflow.flow;

					if(newFlow.module === 'record_call') {
						newFlow = newFlow.children['_'];
					}
					newFlow.children = {};
					if(enabled) {
						newFlow.children['_'] = {
							children: {},
							module: selectedOption.data('module'),
							data: { id: selectedOption.val() }
						}
					}
					self.groupsUpdateCallflow(newCallflow, function(updatedCallflow) {
						self.groupsUpdate(data.group, function(updatedGroup) {
							popup.dialog('close').remove();
							self.groupsRender({ groupId: data.group.id });
						});
					});
				} else {
					popup.dialog('close').remove();
					self.groupsRender({ groupId: data.group.id });
				}
			});

			popup = monster.ui.dialog(featureTemplate, {
				title: data.group.extra.mapFeatures.next_action.title,
				position: ['center', 20]
			});
		},

		groupsBindName: function(template, data) {
			var self = this,
				nameForm = template.find('#form-name');

			monster.ui.validate(nameForm);

			template.find('.save-group').on('click', function() {
				if(monster.ui.valid(nameForm)) {
					var formData = form2object('form-name');

					//formData = self.groupsCleanNameData(formData);

					data = $.extend(true, {}, data, formData);

					self.groupsUpdate(data, function(data) {
						self.groupsRender({ groupId: data.id });
					});
				}
			});

			template.find('.delete-group').on('click', function() {
				monster.ui.confirm(self.i18n.active().groups.confirmDeleteGroup, function() {
					self.groupsDelete(data.id, function(data) {
						toastr.success(monster.template(self, '!' + self.i18n.active().groups.groupDeleted, { name: data.group.name }));

						self.groupsRender();
					});
				});
			});
		},

		groupsBindNumbers: function(template, data) {
			var self = this,
				toastrMessages = self.i18n.active().groups.toastrMessages,
				currentNumberSearch = '';

			// template.on('click', '.list-assigned-items .remove-number', function() {
			// 	var row = $(this).parents('.item-row'),
			// 		spare = template.find('.count-spare'),
			// 		countSpare = spare.data('count') + 1,
			// 		unassignedList = template.find('.list-unassigned-items');

			// 	/* Alter the html */
			// 	row.hide();

			// 	row.find('button')
			// 		.removeClass('remove-number btn-danger')
			// 		.addClass('add-number btn-primary')
			// 		.text(self.i18n.active().add);

			// 	unassignedList.append(row);
			// 	unassignedList.find('.empty-row').hide();

			// 	spare
			// 		.html(countSpare)
			// 		.data('count', countSpare);

			// 	var rows = template.find('.list-assigned-items .item-row');
			// 	/* If no rows beside the clicked one, display empty row */
			// 	if(rows.is(':visible') === false) {
			// 		template.find('.list-assigned-items .empty-row').show();
			// 	}

			// 	/* If it matches the search string, show it */
			// 	if(row.data('search').indexOf(currentNumberSearch) >= 0) {
			// 		row.show();
			// 		unassignedList.find('.empty-search-row').hide();
			// 	}
			// });

			template.on('click', '.list-assigned-items .remove-number', function() {
				var $this = $(this),
					parentRow = $this.parents('.grid-row'),
					callflowId = parentRow.data('callflow_id'),
					groupName = parentRow.data('name'),
					row = $this.parents('.item-row'),
					dataNumbers = [];

				row.slideUp(function() {
					row.remove();

					if ( !template.find('.list-assigned-items .item-row').is(':visible') ) {
						template.find('.list-assigned-items .empty-row').slideDown();
					}

					template.find('.item-row').each(function(idx, elem) {
						dataNumbers.push($(elem).data('id'));
					});

					self.groupsUpdateNumbers(callflowId, dataNumbers, function(callflowData) {
						toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: groupName }));
						self.groupsRender({ groupId: callflowData.group_id });
					});
				});
			});

			template.on('keyup', '.list-wrapper .unassigned-list-header .search-query', function() {
				var rows = template.find('.list-unassigned-items .item-row'),
					emptySearch = template.find('.list-unassigned-items .empty-search-row'),
					currentRow;

				currentNumberSearch = $(this).val().toLowerCase();

				_.each(rows, function(row) {
					currentRow = $(row);
					currentRow.data('search').toLowerCase().indexOf(currentNumberSearch) < 0 ? currentRow.hide() : currentRow.show();
				});

				if(rows.size() > 0) {
					rows.is(':visible') ? emptySearch.hide() : emptySearch.show();
				}
			});

			template.on('click', '.e911-number', function() {
				var e911Cell = $(this).parents('.item-row').first(),
					phoneNumber = e911Cell.data('id');

				if(phoneNumber) {
					var args = {
						phoneNumber: phoneNumber,
						callbacks: {
							success: function(data) {
								if(!($.isEmptyObject(data.data.dash_e911))) {
									e911Cell.find('.features i.feature-dash_e911').addClass('active');
								}
								else {
									e911Cell.find('.features i.feature-dash_e911').removeClass('active');
								}
							}
						}
					};

					monster.pub('common.e911.renderPopup', args);
				}
			});

			template.on('click', '.callerId-number', function() {
				var cnamCell = $(this).parents('.item-row').first(),
					phoneNumber = cnamCell.data('id');

				if(phoneNumber) {
					var args = {
						phoneNumber: phoneNumber,
						callbacks: {
							success: function(data) {
								if('cnam' in data.data && data.data.cnam.display_name) {
									cnamCell.find('.features i.feature-outbound_cnam').addClass('active');
								} else {
									cnamCell.find('.features i.feature-outbound_cnam').removeClass('active');
								}

								if('cnam' in data.data && data.data.cnam.inbound_lookup) {
									cnamCell.find('.features i.feature-inbound_cnam').addClass('active');
								} else {
									cnamCell.find('.features i.feature-inbound_cnam').removeClass('active');
								}
							}
						}
					};

					monster.pub('common.callerId.renderPopup', args);
				}
			});

			template.on('click', '.actions .spare-link:not(.disabled)', function(e) {
				e.preventDefault();

				var $this = $(this),
					args = {
					accountName: monster.apps['auth'].currentAccount.name,
					accountId: self.accountId,
					callback: function(numberList) {
						var parentRow = $this.parents('.grid-row'),
							callflowId = parentRow.data('callflow_id'),
							name = parentRow.data('name');
							dataNumbers = [];

						template.find('.empty-row').hide();

						template.find('.item-row').each(function(idx, elem) {
							dataNumbers.push($(elem).data('id'));
						});

						_.each(numberList, function(val, idx) {
							dataNumbers.push(val.phoneNumber);

							template
								.find('.list-assigned-items')
								.append($(monster.template(self, 'groups-numbersItemRow', { number: val })));
						});

						self.groupsUpdateNumbers(callflowId, dataNumbers, function(callflowData) {
							toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: name }));
							self.groupsRender({ groupId: callflowData.group_id });
						});
					}
				}

				monster.pub('common.numbers.dialogSpare', args);
			});

			template.on('click', '.actions .buy-link', function(e) {
				e.preventDefault();

				monster.pub('common.buyNumbers', {
					searchType: $(this).data('type'),
						callbacks: {
						success: function(numbers) {
							var countNew = 0;

							monster.pub('common.numbers.getListFeatures', function(features) {
								_.each(numbers, function(number, k) {
									countNew++;

									/* Formating number */
									number.viewFeatures = $.extend(true, {}, features);

									var rowTemplate = monster.template(self, 'users-rowSpareNumber', number);

									template.find('.list-unassigned-items .empty-row').hide();
									template.find('.list-unassigned-items').append(rowTemplate);
								});

								var previous = parseInt(template.find('.unassigned-list-header .count-spare').data('count')),
									newTotal = previous + countNew;

								template.find('.unassigned-list-header .count-spare')
									.data('count', newTotal)
									.html(newTotal);

								template.find('.spare-link.disabled').removeClass('disabled');
							});
						},
						error: function(error) {
						}
					}
				});
			});
		},

		groupsBindExtensions: function(template, data) {
			var self = this,
				toastrMessages = self.i18n.active().groups.toastrMessages,
				listExtension = [];

			template.on('click', '.save-extensions', function() {
				var extensionsToSave = [],
					parentRow = $(this).parents('.grid-row'),
					callflowId = parentRow.data('callflow_id'),
					name = parentRow.data('name');

				template.find('.list-assigned-items .item-row').each(function(k, row) {
					var row = $(row),
						number;

					number = (row.data('id') ? row.data('id') : row.find('.input-extension').val()) + '';

					extensionsToSave.push(number);
				});

				self.groupsUpdateExtensions(callflowId, extensionsToSave, function(callflowData) {
					toastr.success(monster.template(self, '!' + toastrMessages.numbersUpdated, { name: name }));
					self.groupsRender({ groupId: callflowData.group_id });
				});
			});

			template.on('click', '#add_extensions', function() {
				var renderNewRow = function(lastExtension) {
					var lastExtension = listExtension[listExtension.length - 1] + 1,
						dataTemplate = {
							recommendedExtension: lastExtension
						},
						newLineTemplate = $(monster.template(self, 'groups-newExtension', dataTemplate)),
						$listExtensions = template.find('.list-assigned-items');

					listExtension.push(lastExtension);
					$listExtensions.find('.empty-row').hide();

					$listExtensions.append(newLineTemplate);
				};

				if(_.isEmpty(listExtension)) {
					self.groupsListExtensions(function(arrayExtension) {
						listExtension = arrayExtension;

						renderNewRow();
					});
				}
				else {
					renderNewRow();
				}
			});

			template.on('click', '.remove-extension', function() {
				var phoneRow = $(this).parents('.item-row'),
					emptyRow = phoneRow.siblings('.empty-row');

				if(phoneRow.siblings('.item-row').size() === 0) {
					emptyRow.show();
				}

				phoneRow.remove();
			});

			template.on('click', '.cancel-extension-link', function() {
				var extension = parseInt($(this).siblings('input').val()),
					index = listExtension.indexOf(extension);

				if(index > -1) {
					listExtension.splice(index, 1);
				}

				$(this).parents('.item-row').remove();
			});
		},

		groupsBindMembers: function(template, data) {
			var self = this,
				displayedRingGroups = $.extend(true, [], data.extra.ringGroup);

			template.find('.distribute-button').on('click', function() {
				var sliders = template.find('.slider-time')
					max = sliders.first().slider('option', 'max'),
					section = Math.floor(max/sliders.length),
					current = 0;
				$.each(sliders, function() {
					$(this).slider('values', [current, current+=section]);
				});
			});

			template.find('.save-groups').on('click', function() {
				var endpoints = [],
					groupId = data.id;

				$.each(template.find('.group-row:not(.title)'), function() {
					var $row = $(this),
						userId = $row.data('user_id'),
						values = $row.find('.slider-time').slider('values'),
						user = {
							delay: values[0],
							timeout: (values[1] - values[0]),
							id: userId,
							endpoint_type: 'user'
						};

					endpoints.push(user);
				});

				self.groupsUpdateBaseRingGroup(groupId, endpoints, function(data) {
					self.groupsRender({ groupId: groupId });
				});
			});

			template.on('click', '.group-row.title .scale-max', function() {
				var $this = $(this),
					input = $this.siblings('.scale-max-input');

				input.show();
				input.focus();	
				$this.hide();
			});

			template.on('blur', '.group-row.title .scale-max-input', function(e) {
				var $this = $(this),
					value = $this.val()
					intValue = parseInt($this.val());
				if(value != $this.data('current') && !isNaN(intValue) && intValue >= 30) {
					self.groupsRenderMemberSliders(template, displayedRingGroups, intValue);
				} else {
					$this.val($this.data('current')).hide();
					$this.siblings('.scale-max').show();
				}
			});

			template.on('keydown', '.group-row.title .scale-max-input', function(e) {
				var charCode = (e.which) ? e.which : event.keyCode;
				if(charCode > 57 && charCode < 96) { return false; }
				else if(charCode === 13) { $(this).blur(); }
				else if(charCode === 27) {
					var $this = $(this);
					$this.val($this.data('current')).blur();
				}
			});

			template.on('click', '.remove-user', function() {
				var parentRow = $(this).parents('.group-row'),
					userId = parentRow.data('user_id');
				template.find('.add-user[data-id="'+userId+'"]').removeClass('in-use');
				parentRow.remove();
				displayedRingGroups = _.filter(displayedRingGroups, function(val) {
					return val.id !== userId;
				});
			});

			template.on('click', '.add-user', function() {
				var $this = $(this),
					newEndpoint = {
						id: $this.data('id'),
						timeout: 20,
						delay: 0,
						endpoint_type: 'user',
						name: $(this).text()
					};

				displayedRingGroups.push(newEndpoint);
				template.find('.grid-time').append(monster.template(self, 'groups-membersRow', {
					id: newEndpoint.id,
					name: newEndpoint.name
				}));
				// createSlider(newEndpoint);
				self.groupsRenderMemberSliders(template, [newEndpoint], parseInt(template.find('.group-row.title .scale-max-input').val()));

				$this.addClass('in-use');
			});
		},

		groupsRenderMemberSliders: function(template, ringGroup, maxSeconds) {
			var self = this,
				scaleSections = 6, //Number of 'sections' in the time scales for the sliders
				scaleMaxSeconds = maxSeconds && maxSeconds >= 30 ? maxSeconds : 120; //Maximum of seconds, corresponding to the end of the scale

			if(!maxSeconds) {
				var currentMax = 0;
				_.each(ringGroup, function(endpoint) {
					currentMax = (endpoint.delay+endpoint.timeout > currentMax) ? endpoint.delay+endpoint.timeout : currentMax;
				});
				scaleMaxSeconds = currentMax > scaleMaxSeconds ? Math.ceil(currentMax/60)*60 : scaleMaxSeconds;
			}

			var sliderTooltip = function(event, ui) {
					var val = ui.value,
						tooltip = '<div class="slider-tooltip"><div class="slider-tooltip-inner">' + val + '</div></div>';

					$(ui.handle).html(tooltip);
				},
				createTooltip = function(event, ui, userId, sliderObj) {
					var val1 = sliderObj.slider('values', 0),
						val2 = sliderObj.slider('values', 1),
						tooltip1 = '<div class="slider-tooltip"><div class="slider-tooltip-inner">' + val1 + '</div></div>',
						tooltip2 = '<div class="slider-tooltip"><div class="slider-tooltip-inner">' + val2 + '</div></div>';

					template.find('.group-row[data-user_id="'+ userId + '"] .slider-time .ui-slider-handle').first().html(tooltip1);
					template.find('.group-row[data-user_id="'+ userId + '"] .slider-time .ui-slider-handle').last().html(tooltip2);
				},
				createSlider = function(endpoint) {
					var groupRow = template.find('.group-row[data-user_id="'+ endpoint.id +'"]'),
						slider = groupRow.find('.slider-time').slider({
							range: true,
							min: 0,
							max: scaleMaxSeconds,
							values: [ endpoint.delay, endpoint.delay+endpoint.timeout ],
							slide: sliderTooltip,
							change: sliderTooltip,
							create: function(event, ui) {
								createTooltip(event, ui, endpoint.id, $(this));
							},
						});
					if(groupRow.hasClass('deleted')) {
						slider.slider('disable');
					}
					createSliderScale(groupRow);
				},
				createSliderScale = function(container, isHeader) {
					var scaleContainer = container.find('.scale-container')
						isHeader = isHeader || false;

					scaleContainer.empty();

					for(var i=1; i<=scaleSections; i++) {
						var toAppend = '<div class="scale-element" style="width:'+(100/scaleSections)+'%;">'
									 + (isHeader 
								 		? (i==scaleSections 
								 			? '<input type="text" value="'+scaleMaxSeconds+'" data-current="'+scaleMaxSeconds+'" class="scale-max-input" maxlength="3"><span class="scale-max">'
								 			:'<span>')
								 			+ Math.floor(i*scaleMaxSeconds/scaleSections) + ' Sec</span>' 
							 			: '')
									 + '</div>';
						scaleContainer.append(toAppend);
					}
					if(isHeader) {
						scaleContainer.append('<span>0 Sec</span>');
					}
				};
		
				_.each(ringGroup, function(endpoint) {
					createSlider(endpoint);
				});
				createSliderScale(template.find('.group-row.title'), true);
		},

		groupsGetCreationData: function(callback) {
			var self = this;

			self.groupsListUsers(function(dataUsers) {
				dataUsers.sort(function(a, b) {
					return a.last_name > b.last_name;
				});

				var dataTemplate = {
					extra: {
						listUsers: dataUsers
					}
				};

				callback && callback(dataTemplate);
			});
		},

		groupsListUsers: function(callback) {
			var self = this;

			self.callApi({
				resource: 'user.list',
				data: {
					accountId: self.accountId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsGetFeaturesData: function(groupId, callback) {
			var self = this;

			monster.parallel({
					group: function(callback) {
						self.groupsGetGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					users: function(callback) {
						self.groupsListUsers(function(data) {
							callback(null, data);
						});
					},
					callflow: function(callback) {
						self.groupsGetRingGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					voicemails: function(callback) {
						self.groupsListVMBoxes(function(data) {
							callback(null, data);
						});
					},
					mainMenu: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 'filter_type':'main' }
							},
							success: function(data) {
								callback(null, data.data && data.data.length > 0 ? _.find(data.data, function(callflow) { return callflow.numbers[0] === "MainOpenHoursMenu" }) : null);
							}
						});
					},
					userCallflows: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 
									'has_key':'owner_id',
									'filter_type':'mainUserCallflow'
								}
							},
							success: function(data) {
								callback(null, data.data);
							}
						});
					}
				},
				function(err, results) {
					results.group.extra = self.groupsGetGroupFeatures(results.group);
					_.each(results.userCallflows, function(userCallflow) {
						var user = _.find(results.users, function(user) { return userCallflow.owner_id === user.id });
						if(user) {
							userCallflow.userName = user.first_name + ' ' + user.last_name;
						}
					});
					callback && callback(results);
				}
			);
		},

		groupsGetNameData: function(groupId, callback) {
			var self = this;

			self.groupsGetGroup(groupId, function(data) {
				callback && callback(data);
			});
		},

		groupsFormatNumbersData: function(data, callback) {
			var self = this,
				response = {
					emptyExtensions: true,
					extensions: [],

					emptyAssigned: true,
					assignedNumbers: {},
					countSpare: 0,
					unassignedNumbers: {}
				};


			monster.pub('common.numbers.getListFeatures', function(features) {
				_.each(data.numbers.numbers, function(number, id) {
					/* Formating number */
					number.viewFeatures = $.extend(true, {}, features);
					/* TODO: Once locality is enabled, we need to remove it */
					number.localityEnabled = 'locality' in number ? true : false;

					_.each(number.features, function(feature) {
						number.viewFeatures[feature].active = 'active';
					});

					if(number.used_by === '') {
						response.unassignedNumbers[id] = number;
						response.countSpare++;
					}
				});

				if('groupCallflow' in data.callflow && 'numbers' in data.callflow.groupCallflow) {
					_.each(data.callflow.groupCallflow.numbers, function(number) {
						if(!(number in data.numbers.numbers)) {
							response.extensions.push(number);
						}
						else {
							response.assignedNumbers[number] = data.numbers.numbers[number];
						}
					});
				}
				response.emptyExtensions = _.isEmpty(response.extensions);
				response.emptyAssigned = _.isEmpty(response.assignedNumbers);
				response.emptySpare = _.isEmpty(response.unassignedNumbers);

				callback && callback(response);
			});
		},

		groupsGetNumbersData: function(groupId, callback) {
			var self = this;

			monster.parallel({
					callflow: function(callbackParallel) {
						var response = {};

						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: { 
									'filter_group_id': groupId,
									'filter_type': 'userGroup'
								}
							},
							success: function(data) {
								if(data.data.length > 0) {
									self.groupsGetCallflow(data.data[0].id, function(callflow) {
										response.groupCallflow = callflow;
										callbackParallel && callbackParallel(null, response);
									});
								} else {
									callbackParallel && callbackParallel(null, null);
								}
							}
						});
					},
					numbers: function(callbackParallel) {
						self.callApi({
							resource: 'numbers.list',
							data: {
								accountId: self.accountId
							},
							success: function(numbers) {
								callbackParallel && callbackParallel(null, numbers.data);
							}
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		groupsGetMembersData: function(groupId, globalCallback) {
			var self = this;

			monster.parallel({
					users: function(callback) {
						self.groupsListUsers(function(data) {
							callback(null, data);
						});
					},
					group: function(callback) {
						self.groupsGetGroup(groupId, function(data) {
							callback(null, data);
						});
					},
					baseCallflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(data) {
							callback(null, data);
						});
					}
				},
				function(err, results) {
					globalCallback && globalCallback(results);
				}
			);

		},

		groupsFormatMembersData: function(data) {
			var self = this,
				mapUsers = {},
				flow = data.baseCallflow.flow;

			_.each(data.users, function(user) {
				mapUsers[user.id] = user;
			});

			var endpoints = flow.data.endpoints;

			_.each(endpoints, function(endpoint) {
				endpoint.delay = parseInt(endpoint.delay);
				endpoint.timeout = parseInt(endpoint.timeout);

				if(endpoint.id in mapUsers) {
					endpoint.name = mapUsers[endpoint.id].first_name + ' ' + mapUsers[endpoint.id].last_name;
					mapUsers[endpoint.id].inUse = true;
				} else {
					endpoint.name = self.i18n.active().groups.userDeleted;
					endpoint.deleted = true;
				}
			});

			data.group.extra = {
				ringGroup: endpoints,
				remainingUsers: mapUsers
			};

			return data.group;
		},

		groupsUpdateNumbers: function(callflowId, newNumbers, callback) {
			var self = this;

			self.groupsGetCallflow(callflowId, function(callflow) {
				_.each(callflow.numbers, function(number) {
					if(number.length < 7) {
						newNumbers.push(number);
					}
				});

				callflow.numbers = newNumbers;

				self.groupsUpdateCallflow(callflow, function(callflow) {
					callback && callback(callflow);
				});
			});
		},

		groupsUpdateExtensions: function(callflowId, newNumbers, callback) {
			var self = this;

			self.groupsGetCallflow(callflowId, function(callflow) {
				_.each(callflow.numbers, function(number) {
					if(number.length > 6) {
						newNumbers.push(number);
					}
				});

				callflow.numbers = newNumbers;

				self.groupsUpdateCallflow(callflow, function(callflow) {
					callback && callback(callflow);
				});
			});
		},

		groupsListExtensions: function(callback) {
			var self = this,
				extensionList = [];

			self.groupsListCallflows(function(callflowList) {
				_.each(callflowList, function(callflow) {
					_.each(callflow.numbers, function(number) {
						if(number.length < 7) {
							var extension = parseInt(number);

							if(extension > 1) {
								extensionList.push(extension);
							}
						}
					});
				});

				extensionList.sort(function(a, b) {
					var parsedA = parseInt(a),
						parsedB = parseInt(b),
						result = -1;

					if(parsedA > 0 && parsedB > 0) {
						result = parsedA > parsedB;
					}

					return result;
				});

				callback && callback(extensionList);
			});
		},

		groupsListCallflows: function(callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId
				},
				success: function(callflows) {
					callback && callback(callflows.data);
				}
			});
		},

		groupsListMedias: function(callback) {
			var self = this;

			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: { 'key_missing':'type' }
				},
				success: function(medias) {
					callback && callback(medias.data);
				}
			});
		},

		groupsListVMBoxes: function(callback) {
			var self = this;

			self.callApi({
				resource: 'voicemail.list',
				data: {
					accountId: self.accountId
				},
				success: function(medias) {
					callback && callback(medias.data);
				}
			});
		},

		groupsCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'group.create',
				data: {
					accountId: self.accountId,
					data: data.group
				},
				success: function(dataGroup) {
					data.callflow.group_id = dataGroup.data.id;
					data.baseCallflow.group_id = dataGroup.data.id;

					self.callApi({
						resource: 'callflow.create',
						data: {
							accountId: self.accountId,
							data: data.baseCallflow
						},
						success: function(dataBaseCallflow) {
							data.callflow.flow.data.id = dataBaseCallflow.data.id;
							self.callApi({
								resource: 'callflow.create',
								data: {
									accountId: self.accountId,
									data: data.callflow
								},
								success: function(data) {
									callback && callback(dataGroup.data);
								}
							});
						},
						error: function() {
							self.callApi({
								resource: 'group.delete',
								data: {
									accountId: self.accountId,
									groupId: dataGroup.data.id
								}
							});
						}
					});
				}
			});
		},

		groupsGetRingGroup: function(groupId, callback, callbackError) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: { 
						'filter_group_id': groupId,
						'filter_type': 'userGroup'
					}
				},
				success: function(data) {
					if(data.data.length > 0) {
						self.groupsGetCallflow(data.data[0].id, function(callflow) {
							callback && callback(callflow);
						});
					}
					else {
						callbackError && callbackError(data);

						toastr.error(self.i18n.active().groups.ringGroupMissing);
					}
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		groupsGetBaseRingGroup: function(groupId, callback, callbackError) {
			var self = this;

			self.callApi({
				resource: 'callflow.list',
				data: {
					accountId: self.accountId,
					filters: { 
						'filter_group_id': groupId,
						'filter_type': 'baseGroup'
					}
				},
				success: function(data) {
					if(data.data.length > 0) {
						self.groupsGetCallflow(data.data[0].id, function(callflow) {
							callback && callback(callflow);
						});
					}
					else {
						callbackError && callbackError(data);

						toastr.error(self.i18n.active().groups.ringGroupMissing);
					}
				},
				error: function(data) {
					callbackError && callbackError(data);
				}
			});
		},

		groupsComputeTimeout: function(endpoints) {
			var globalTimeout = 0;

			_.each(endpoints, function(endpoint) {
				var delay = parseInt(endpoint.delay),
					timeout = parseInt(endpoint.timeout),
					total = delay + timeout;

				if(total > globalTimeout) {
					globalTimeout = total;
				}
			});

			return globalTimeout;
		},

		groupsUpdateBaseRingGroup: function(groupId, endpoints, callback) {
			var self = this;

			monster.parallel({
					group: function(callback) {
						self.groupsGetGroup(groupId, function(data) {
							var areDifferent = false;

							_.each(endpoints, function(endpoint) {
								if(endpoint.id in data.endpoints) {
									delete data.endpoints[endpoint.id];
								}
								else {
									areDifferent = true;
									return false;
								}
							});

							if(!_.isEmpty(data.endpoints)) {
								areDifferent = true;
							}

							if(areDifferent) {
								data.endpoints = {};

								_.each(endpoints, function(v) {
									data.endpoints[v.id] = { type: 'user' };
								});

								self.groupsUpdate(data, function(data) {
									callback && callback(null, data);
								});
							}
							else {
								callback && callback(null, data);
							}
						});
					},
					callflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(ringGroup) {
							ringGroup.flow.data.endpoints = endpoints;
							ringGroup.flow.data.timeout = self.groupsComputeTimeout(endpoints);

							// if(extraNode) {
							// 	flow.children['_'] = {
							// 		data: {
							// 			id: extraNode.id
							// 		},
							// 		module: extraNode.module,
							// 		children: {}
							// 	}
							// }

							self.groupsUpdateCallflow(ringGroup, function(data) {
								callback && callback(null, data);
							});
						});
					},
				},
				function(error, results) {
					callback && callback(results);
				}
			);
		},

		groupsUpdate: function(group, callback) {
			var self = this;

			delete group.extra;

			self.callApi({
				resource: 'group.update',
				data: {
					accountId: self.accountId,
					groupId: group.id,
					data: group
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsUpdateCallflow: function(callflow, callback) {
			var self = this;

			delete callflow.metadata;

			self.callApi({
				resource: 'callflow.update',
				data: {
					accountId: self.accountId,
					callflowId: callflow.id,
					data: callflow
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsGetGroup: function(groupId, callback) {
			var self = this;

			self.callApi({
				resource: 'group.get',
				data: {
					groupId: groupId,
					accountId: self.accountId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsDelete: function(groupId, callback) {
			var self = this;

			monster.parallel({
					group: function(callback) {
						self.callApi({
							resource: 'group.delete',
							data: {
								accountId: self.accountId,
								groupId: groupId
							},
							success: function(data) {
								callback && callback(null, data.data);
							}
						});
					},
					callflow: function(callback) {
						self.groupsGetRingGroup(groupId, function(data) {
							self.callApi({
								resource: 'callflow.delete',
								data: {
									accountId: self.accountId,
									callflowId: data.id
								},
								success: function(data) {
									callback && callback(null, data);
								}
							});
						},
						function(data) {
							callback && callback(null, data);
						});
					},
					baseCallflow: function(callback) {
						self.groupsGetBaseRingGroup(groupId, function(data) {
							self.callApi({
								resource: 'callflow.delete',
								data: {
									accountId: self.accountId,
									callflowId: data.id
								},
								success: function(data) {
									callback && callback(null, data);
								}
							});
						},
						function(data) {
							callback && callback(null, data);
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		groupsGetCallflow: function(callflowId, callback) {
			var self = this;

			self.callApi({
				resource: 'callflow.get',
				data: {
					accountId: self.accountId,
					callflowId: callflowId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		groupsGetData: function(callback) {
			var self = this;

			monster.parallel({
					groups: function(callback) {
						self.callApi({
							resource: 'group.list',
							data: {
								accountId: self.accountId
							},
							success: function(dataGroups) {
								callback(null, dataGroups.data);
							}
						});
					},
					callflows: function(callback) {
						self.callApi({
							resource: 'callflow.list',
							data: {
								accountId: self.accountId,
								filters: {'has_key':'group_id'}
							},
							success: function(dataCallflows) {
								callback(null, dataCallflows.data);
							}
						});
					}
				},
				function(err, results) {
					callback && callback(results);
				}
			);
		},

		groupsRemoveOverlay: function() {
			$('body').find('#groups_container_overlay').remove();
		}
	};

	return app;
});
