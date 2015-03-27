define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster');

	var app = {
		name: 'voip',

		css: [ 'app' ],

		i18n: { 
			'en-US': { customCss: false },
			'fr-FR': { customCss: false },
			'ru-RU': { customCss: false }
		},

		requests: {},
		subscribe: {},

		subModules: ['devices', 'groups', 'numbers', 'strategy', 'callLogs', 'users', 'myOffice', 'featureCodes', 'vmboxes'],

		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		initApp: function(callback) {
			var self = this;

			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		render: function(container){
			var self = this,
				parent = container || $('#monster-content'),
				template = $(monster.template(self, 'app'));

			/* On first Load, load my office */
			template.find('.category#myOffice').addClass('active');
			monster.pub('voip.myOffice.render', { parent: template.find('.right-content') });

			self.bindEvents(template);

			parent
				.empty()
				.append(template);
		},

		formatData: function(data) {
			var self = this;
		},

		bindEvents: function(parent) {
			var self = this,
				container = parent.find('.right-content');

			parent.find('.category').on('click', function() {
				// Get the ID of the submodule to render
				var $this = $(this),
					args = {
						parent: container
					},
					id = $this.attr('id');

				// Display the category we clicked as active
				parent
					.find('.category')
					.removeClass('active');
				$this.toggleClass('active');

				// Empty the main container and then render the submodule content
				container.empty();
				monster.pub('voip.' + id + '.render', args);
			});
		}
	};

	return app;
});
