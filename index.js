var xml2js=$('xml2js');
var parser=new xml2js.Parser();

exports.Client=function(port, host, username, password, localhost)
{
	var client;
	var handler;
	var queue=[];
	var setHandler=function(handlr)
	{
		handler=handlr;
		// console.log(queue);
		if(queue.length && handler)
		{
			handler=null;
			handlr(queue.shift());				
		}
	}
	
	this.skip=function(nextHandler)
	{
		return function(data)
		{
			// console.log('skipping following data:');
			// console.log(data);
			setHandler(nextHandler);
		}
	}
	
	var self=this;
	this.getSessionId=function(data){
        
        //console.log(data);
        if(data.endsWith('</stream:features>'))
            data+='</stream:stream>';
        else
            return setHandler(this.getSessionId);
		parser.parseString(data, function(error, d){
            if(error)
                console.log(error);
			client.write('<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="'+d['stream:stream']['stream:features'][0].mechanisms[0].mechanism+'">'+new Buffer('\0'+username+'\0'+password).toString('base64')+'</auth>');
			setHandler(self.auth);
		});
	};
	
	this.auth=function(data)
	{
		parser.parseString(data, function(error, d){
		if(!error)
		{
			setHandler(self.skip(self.features));
			client.write("<?xml version='1.0' ?><stream:stream to='"+host+"' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'  xml:lang='en' version='1.0'>");
		}
		else
		{
			console.log('error while parsing xml');
			console.log('"'+data+'"');
		}
		});
	};
	
	this.features=function(data)
	{
		//console.log(data);
		parser.parseString(data, function(error, d)
		{
			self.bind('Commander/8a56fbbe-7deb-46eb-b461-466d5e2c5fb3');
		});
	}
	
	this.createSession=function(jid){
		client.write("<iq id='uid:d519cca8:00000002' type='set' from='"+jid+"' xmlns='jabber:client'><session xmlns='urn:ietf:params:xml:ns:xmpp-session'/></iq>");
		self.pubsub(jid);
	};
	
	this.bind=function(resource)
	{
		// console.log('binding');
		
		setHandler(self.bound);
		client.write("<iq id='uid:d519cca8:00000001' type='set' from='"+username+"@"+localhost+resource+"' xmlns='jabber:client'><bind xmlns='urn:ietf:params:xml:ns:xmpp-bind'><resource>"+resource+"</resource></bind></iq>");
	}
	
	this.bound=function(data)
	{
		parser.parseString(data, function(error, d){
			self.createSession(d.iq.bind[0].jid[0]);
		});
	};
	
	var notification=function(data)
	{
		if(typeof(data)=='undefined')
			return;
		//console.log(data);
		if(data.endsWith('</message>'))
			processNotification(data);

		setHandler(notification);
		queue.unshift(data);
	}
	
	var processNotification=function(data)
	{
        //console.log(data);
		parser.parseString(data, function(error, message)
		{
			if(error)
				return queue.unshift(data);
			if(message.message.event[0].items[0].item[0].MediaRecordingMotionDetectedAlert)
                self.emit('motionDetected', message.message.event[0].items[0].item[0].MediaRecordingMotionDetectedAlert[0].ThumbnailSnapshot[0]._);
		});
	}
	
	this.pubsub=function(jid)
	{
		setHandler(this.skip(this.skip(notification)));
		client.write("<iq to='server@127.0.0.1/NvrCore' id='uid:d519cca8:00000003' type='set' from='"+jid+"' xmlns='jabber:client'><pubsub xmlns='http://jabber.org/protocol/pubsub'><subscribe node='urn:logitech-com:logitech-alert:remote-event:device:media:recording:motion-detected' jid='"+jid+"'/><options><x xmlns='jabber:x:data' type='submit'><field type='hidden' var='FORM_TYPE'><value>http://jabber.org/protocol/pubsub#subscribe_options</value></field><field var='pubsub#subscription_type'><value>items</value></field></x></options></pubsub></iq>");
		//client.write("<iq to='server@127.0.0.1/NvrCore' id='uid:d519cca8:00000004' type='set' from='"+jid+"' xmlns='jabber:client'><pubsub xmlns='http://jabber.org/protocol/pubsub'><subscribe node='urn:logitech-com:logitech-alert:remote-event:device:media:recording:started' jid='"+jid+"'/><options><x xmlns='jabber:x:data' type='submit'><field type='hidden' var='FORM_TYPE'><value>http://jabber.org/protocol/pubsub#subscribe_options</value></field><field var='pubsub#subscription_type'><value>items</value></field></x></options></pubsub></iq>");
	}

	setHandler(this.getSessionId);

	client=$('net').connect({port:port, host:host});
	client.setEncoding('utf8');
	client.on('connect', function(){
		client.write('<?xml version="1.0" ?><stream:stream to="'+host+'" xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" xml:lang="en" version="1.0">');
	});
	client.on('data', function(data){
	    queue.push(data);
	    //console.log(queue);
		if(queue.length==2)
		{
		    var nextData=queue.shift();
	        queue.shift();
		    queue.push(data=nextData+data);
		}
		
		var startTag=data.substr(1,data.indexOf(' '));
		if(/*data.endsWith('</'+startTag+'>') &&*/ typeof(handler)!='undefined')
			setHandler(handler);
	});
	
	this.end=function(){
        client.end();
	}
}

$('util').inherits(exports.Client, $('events').EventEmitter);