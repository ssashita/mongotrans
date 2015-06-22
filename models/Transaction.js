var mongoose = require('mongoose');
var TRANSACTION_TYPE = {
	NEW : 0,
	UPDATE: 1,
	DELETE: 2
};
//Max time that a transaction is allowed to be in the 'new' state before it is rolled back
var MAXTRANSTIME = 1000;

//Transaction collection schema
var TransactionSchema = mongoose.Schema({
	state : String,
	startTime : Date,
	participants : [ {
		type : Number,
		collection : Object,
		querySpec : Object,
		rollbackAction: Object,
		action: Object
	} ]
});

//Create a collection called Transaction
mongoose.model('Transaction', TransactionSchema);

var TransactionUtils={};

//Execute a transaction
TransactionUtils.executeTransaction = function(types, collections, querySpecs, actions, rollbackActions, callback) {
	var i;
	var id = new ObjectId();
	var trans = new Transaction();
	trans._id = id;
	trans.state = 'new';
	trans.startTime = Date.now();
	trans.participants=[];
	for (var i = 0; i < types.length; i++) {
		var type = types[i];
		var collection = collections[i];
		var querySpec = querySpecs[i];
		var rollbackAction = rollbackActions[i];
		var action = actions[i];
		trans.participants[trans.participants.length] = {type: type, collection: collection, querySpec: querySpec, 
				action: action, rollbackAction: rollbackAction};
	}
	trans.save(function(err) {
		//Logging
		if (!err) {
			TransactionUtils.performActions(trans);
		}
	});
};

//perform the action specified for each participant or party to the transaction. The actions are performed recursively 
//in the callbacks of the previous action, only if previous action was successful. 
TransactionUtils.performActions = function(trans) {
	var parties = trans.participants;
	var transactionError;
	
	var performRecursive = function(participants) {
		if (participants.length <= 0)
			return;
		var participant = participants[0];
		//if (!transactionError) {
			var querySpec = participant.querySpec;
			var collection = participant.collection;
			var action = participant.action;
			var type = participant.type;

			var callback = function(err, result) {
				//Logging
				if (err) {
					//Logging
					
					//transactionError = 1;
				}
				else {
					if (participants.length > 1) {
						performRecursive(participants.slice(1));
					}
					else if (participants.length === 1) {
						//Last participant - COMMIT the transaction
						TransactionUtils.commitTransaction(trans._id, MAXTRANSTIME);
					}
				}
			};
			
			if (type === TRANSACTION_TYPE.DELETE) {
				action = {documentStatus: TRANSACTION_TYPE.DELETE};
			}

			var actionCopy = {};
			for (var j in action) {
				if (action.hasOwnProperty(j)) {
					actionCopy[j] = action[j];
				}
			}
			actionCopy['$push'] =  {txns: {_id: trans._id}};
			switch (participant.type) {
			case TRANSACTION_TYPE.NEW:
				var newObj = new collection(actionCopy);
				newObj.save(function(err){
					if (!err) {
						participant.querySpec = {_id: newObj._id};
					}
					callback(err);
				});
				break;
			case TRANSACTION_TYPE.UPDATE:
			case TRANSACTION_TYPE.DELETE:
				collection.update(querySpec, actionCopy, callback);
				break;
			};
		}
	//};
	performRecursive(parties);
};

TransactionUtils.commitTransaction = function(txnid, maxTransactionTime) {
	var now = Date.now();
	var cutOff = now - maxTransactionTime;

	Transaction.update({
		_id : txnid,
		state : 'new',
		startTime : {
			'$gt' : cutOff
		}
	}, {
		'$set' : {
			state : 'commit'
		}
	}, function(err, trans) {
		if (!err) {
			TransactionUtils.retireTransaction(trans);
		}
	});
};

TransactionUtils.retireTransaction = function(trans) {
	var querySpec;
	var participants = trans.participants;
	for (var int = 0; participants && (int < participants.length); int++) {
		var participant = participants[int];
		participant.collection.update({
			_id : participant.objId,
			'txns._id' : trans._id
		}, {
			'$pull' : {
				'txns' : trans._id
			}
		},function(err, result) {
			//Logging
		});
	}
	Transaction.remove({_id: trans._id});
};

TransactionUtils.rollback = function(trans) {
	for (var i = 0; i < trans.participants.length; i++) {
		var participant = trans.participants[i];
		var collection = participant.collection;
		var querySpec = participant.querySpec;
		var action = participant.rollbackAction;
		if (participant.type === TRANSACTION_TYPE.DELETE) {
			action = {documentStatus: undefined};
		}
		var actionCopy = {};
		for (var j in action) {
			if (action.hasOwnProperty(j)) {
				actionCopy[j] = action[j];
			}
		}
		switch (participant.type) {
		case TRANSACTION_TYPE.NEW:
			collection.remove(querySpec,function(err) {
				//Logging
			});
			break;
		case TRANSACTION_TYPE.UPDATE:
		case TRANSACTION_TYPE.DELETE:
			var querSpecCopy = {};
			for (j in action) {
				if (querySpec.hasOwnProperty(j)) {
					querSpecCopy[j] = querySpec[j];
				}
			}
			querySpecCopy['txns._id'] = trans._id;
			actionCopy['$pull'] =  {txns: {_id: trans._id}};
			collection.update(querySpecCopy,
					actionCopy);
			break;
		}

	}
	Transaction.remove({_id: trans._id});
};

//function to be called may be with a setInterval() so that transactions get cleaned up
TransactionUtils.cleanupTransactions = function(maxTransactionTime)
{
	Transaction.find({
		state : 'commit'
	}).exec(function(err, transArr) {
		if (!err) {
			for (var i = 0; i < transArr.length; i++) {
				var trans = transArr[i];
				TransactionUtils.retireTransaction(trans);
			}
		}
	});
	var cutOff = Date.now() - maxTransactionTime;
	Transaction.update({state: 'new', 
		startTime: {'$lt': cutOff }}, {$set: {state: 'rollback'}},
		function(err, results) {
			//Logging
			
		});
	//Actually rollback
		Transaction.find({state: 'rollback'}, function(err, transarr) {
			//Logging
			
			if (!err) {
				for (var i = 0; i < transarr.length; i++) {
					var trans = transarr[i];
					TransactionUtils.rollback(trans);
				}
			}
		});	
	
};
module.exports=[TransactionUtils.executeTransaction, TransactionUtils.cleanupTransactions];