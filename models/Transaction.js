var mongoose = require('mongoose');
var TRANSACTION_TYPE = {
	NEW : 0,
	UPDATE: 1,
	DELETE: 2
};
var MAXTRANSTIME = 1000;

var TransactionSchema = mongoose.Schema({
	state : String,
	startTime : Date,
	participants : [ {
		type : Number,
		collection : Object,
		objId : ObjectId,
		rollbackAction: Object,
		action: Object
	} ]
});

mongoose.model('Transaction', TransactionSchema);

var TransactionUtils={};

TransactionUtils.createTransaction = function(types, collections, objIds, actions, rollbackActions, callback) {
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
		var objId = objIds[i];
		var rollbackAction = rollbackActions[i];
		var action = actions[i];
		trans.participants[trans.participants.length] = {type: type, collection: collection, objId: objId, 
				action: action, rollbackAction: rollbackAction};
	}
	trans.save(function(err) {
		//Logging
		if (!err) {
			TransactionUtils.performActions(trans);
		}
	});
};

TransactionUtils.performActions = function(trans) {
	var participants = trans.participants;
	var operation;
	var transactionError;
	var totalNumberOfActions = participants.length;
	var numberOfFinishedActions=0;
	
	for (var int = 0; participants && (int < participants.length); int++) {
		var participant = participants[int];
		var callback = function(err) {
			//Logging
			if (err) {
				transactionError = 1;
			}
		};
		switch (participant.type) {
		case TRANSACTION_TYPE.NEW:
			operation = collection.save;
			break;
		case TRANSACTION_TYPE.UPDATE:
			operation = collection.update;
		case TRANSACTION_TYPE.DELETE:
			operation = collection.remove;
			break;
		}
		if (int == participants.length-1 ) {
			operation(action, function(err) {
				if (!err) {
					numberOfFinishedActions++;
					TransactionUtils.commitTransaction(trans._id, MAXTRANSTIME);
				}
				else {
					//Logging
				}
				callback.apply(arguments);
			});
		}
		else {
			operation(action, callback);
		}
	}
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

TransactionUtils.cleanupTransactions(maxTransactionTime)
{
	find({
		state : 'commit'
	}).exec(function(err, transArr) {
		if (!err) {
			for (var i = 0; i < transArr.length; i++) {
				TransactionUtils.retireTransaction(trans);
			}
		}
	});
	var cutOff = Date.now() - maxTransactionTime;
	Transaction.update({_id: trans._id, state: 'new', 
		startTime: {'$lt': cutOff }}, {$set: {state: 'rollback'}},
		function(err, results) {
			//Logging
		});
	//Actually rollback
	Transaction.findOne({_id: trans._id}, function(err, trans) {
		//Logging
		
		if (!err) {
			TransactionUtils.rollback(trans);
		}
	});
};

TransactionUtils.rollback(trans) {
	for (var i = 0; i < trans.participants.length; i++) {
		var participant = trans.participants[i];
		var collection = participant.collection;
		var objid = participant.objId;
		var action = participant.rollbackActions;
		var actionCopy = {};
		for (var j in action) {
			if (action.hasOwnProperty(j)) {
				actionCopy[j] = action[j];
			}
		}
		switch (participant.type) {
		case TRANSACTION_TYPE.NEW:
			rollbackOperation = collection.remove;
			break;
		case TRANSACTION_TYPE.UPDATE:
			rollbackOperation = collection.update;
			break;	
		case TRANSACTION_TYPE.DELETE:
			rollbackOperation = collection.save;
			break;
		}
		actionCopy['$pull'] =  {txns: {_id: trans._id}};
		rollbackOperation({_id: objid, 'txns._id': trans._id},
				actionCopy);
	}
	Transaction.remove({_id: trans._id});
};