var mongoose = require('mongoose');
var MEMBERSHIP_STATUS = {
	ACTIVE:  0,
	EVICTED: 1
};

var HandleSchema = mongoose.Schema({
	name: "handleName", 
	group: gid, 
	user: id, 
	status: Number,
	reportsForAbuse: [ { by: {type:mongoose.Schema.Types.ObjectId, ref:'Handle'}, when: Date}], 
	warnings: [ {byModerator: {type:mongoose.Schema.Types.ObjectId, ref:'Handle'},  when: Date}],
	notes: [{byModerator: {type:mongoose.Schema.Types.ObjectId, ref:'Handle'}, text: String, when: Date}]
    
});

mongoose.model('Handle', HandleSchema);
module.exports=[MEMBERSHIP_STATUS, HandleSchema];