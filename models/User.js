var mongoose=require('mongoose');

var UserSchema = mongoose.Schema({
	phone: Number, 
	passwd: String, 
	name:String, 
	handles: [{type: mongoose.Schema.Types.ObjectId, ref: 'Handle'}], 
	favorites: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}], 
	profile: {photoPath: String},
	reviews: [{by:{type: mongoose.Schema.Types.ObjectId, ref: 'User'}, text:String}],
	rating: [{by:{type: mongoose.Schema.Types.ObjectId, ref: 'User'}, value: Number}]
});

mongoose.model('User', UserSchema);