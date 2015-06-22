var mongoose = require('mongoose');
var GROUP_RATING = {
		ONE:1, TWO:2, THREE:3, FOUR:4, FIVE:5
};
var GroupSchema = mongoose.Schema({
	name: String, featured: Boolean, 
	parent: {type: mongoose.Schema.Types.ObjectId, ref:'Group'}, 
	closed: Boolean, 
	o2m: Boolean, 
	owner: {type:mongoose.Schema.Types.ObjectId, ref:'Handle'}, 
	moderators: [{type:mongoose.Schema.Types.ObjectId, ref:'Handle'}], 
	reviews: [{by:{type: mongoose.Schema.Types.ObjectId, ref: 'User'}, text:String}],
	rating: [{by:{type: mongoose.Schema.Types.ObjectId, ref: 'User'}, value: Number}]
});

mongoose.model('Group', GroupSchema);
module.exports=[GroupSchema, GROUP_RATING];