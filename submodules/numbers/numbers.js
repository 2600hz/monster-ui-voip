define(function(require){
	var $ = require('jquery'),
		monster = require('monster');

	var app = {

		requests: {
		},

		subscribe: {
			'voip.numbers.render': 'numbersRender'
		},

		numbersRender: function(args){
			var self = this,
				parent = args.parent || $('#ws_content'),
				callback = args.callback;

			monster.pub('common.numbers.render', {
				container: parent,
				viewType: 'pbx',
				callbackAfterRender: callback
			});
		}
	};

	return app;
});
