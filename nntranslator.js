const zipTech = require('./zipTech.js');					//jszip functions for editing MSE files
const fs = require('fs');									//file system managment

//if used on another bot, replace these with however you handle the discord client
//and update Client in the functions to whatever your client variable is
const eris = require('./eris.js');							//Discord handler
var Client = eris.Client();									//Discord client

function pullAll(hardLimit) {								//pull all cards from #bot-posting-saved
	let cards = [];
	Client.channels.cache.get("791935587065004063").messages.fetch({limit:Math.min(100, hardLimit)})
		.then(messages => runMessages(messages, cards, hardLimit))
		.catch(console.error)
}
function runMessages(messages, cards, hardLimit) {			//looping function to pull messages 100 at a time (roughly 12k/minute)
	let count = messages.size;
	let mArray = messages.array();
	if(!count)
		nnTranslator(cards)
	let lastID = mArray[count-1].id;
	//console.log(`Running to ${lastID}`)
	for(let m in mArray) {
		if(!mArray[m].embeds || mArray[m].embeds.length == 0)
			continue;
		let messEmbed = mArray[m].embeds[0];
		for(let f in messEmbed.fields)
			cards.push(messEmbed.fields[f]);
	}
	if(hardLimit) {
		hardLimit -= count;
		if(hardLimit <= 0) {
			nnTranslator(cards);
			return;
		}
	}
	if(count < 100){ //less than 100 messages, end of the channel
		nnTranslator(cards)
	}else{ //delay a half second for discord limits
		setTimeout(() => {
			Client.channels.cache.get("791935587065004063").messages.fetch({limit:Math.min(100, hardLimit), before:lastID})
				.then(messages => runMessages(messages, cards, hardLimit))
				.catch(console.error)
		}, 3000);
	}
}

function nnTranslator(cards, chan) {						//converts array of embed data into .mse-set file
	fs.copyFile('quarantine/base.mse-set', 'quarantine/neural_output.mse-set', (err) => {
	  if (err) throw err;
		let output = "";
		for(let c in cards) {
			let thisCard = cards[c];
			/*
				{
					name: "**Card Name <mana cost emojis>**",
					value: "Typeline (Rarity)\nRules Text\n(P/T)\n~~\nsome other data"
				}
			*/
			let cardData = {
				name: "",
				casting_cost: "",
				type: "",
				super_type: "",
				sub_type: "",
				rarity: "",
				rule_text: "",
				flavor_text: "",
				power: "",
				toughness: "",
				loyalty: "",
				illustrator: "",
				name_2: "",
				casting_cost_2: "",
				type_2: "",
				super_type_2: "",
				sub_type_2: "",
				rule_text_2: "",
				flavor_text_2: "",
				power_2: "",
				toughness_2: "",
				loyalty_2: "",
				illustrator_2: "",
				stylesheet: "",
				styling_data: {},
				notes: ""
			}
			cardData.stylesheet = "m15-altered"
			let splitRules = thisCard.value.split("~~~~~~~~\n"); //split off dfcs
			thisCard.value = splitRules[0];
			let splitName = thisCard.name.match(/\*\*([^<]+) *([^*]*)\*\*/);
			if(splitName) { //pull out name and mana cost
				cardData.name = splitName[1].replace(/ $/, "");
				if(splitName[2]) {
					cardData.casting_cost = unsymbolize(splitName[2]);
				}
			}
			let splitTypeLine = thisCard.value.match(/^(?:\*\*)?([^(\n]+) *(?:\*\*)?\n?(?:\*\*)?\(([^)]+)?\)(?:\*\*)?\n/);
			if(splitTypeLine) { //pull out typeline and rarity
				let splitType = splitTypeLine[1].split(/ [—~] /);
				cardData.super_type = splitType[0];
				if(splitType[1])
					cardData.sub_type = splitType[1];
				if(splitType[2])
					cardData.rarity = splitTypeLine[2].toLowerCase();
				thisCard.value = thisCard.value.replace(splitTypeLine[0], "") //remove it from the value
			}
			thisCard.value = thisCard.value.replace(/\n~~\n.*/, "")	//remove card notes
			thisCard.value = thisCard.value.replace(/\n+$/, "");	//remove any trailing linebreaks
			let ptMatch = thisCard.value.match(/(?:\n|^)\(?(\d+)\/(\d+)\)?$/);
			if(ptMatch) { //has a pt
				cardData.power = ptMatch[1];
				cardData.toughness = ptMatch[2];
				thisCard.value = thisCard.value.replace(ptMatch[0], "");
			}
			cardData.rule_text = unsymbolize(thisCard.value.replace(/\n​?$/, "").replace(/@/g, "CARDNAME").replace(/~/g, "—")); //everything else is rules text
			if(splitRules[1]) { //dfc stuff
				let backFace = splitRules[1];
				let splitName = backFace.match(/^([^\n<]+) *([^\n]+)\n/);
				if(splitName) { //pull out name and mana cost
					cardData.name_2 = splitName[1].replace(/ $/, "");
					if(splitName[2]) {
						cardData.casting_cost_2 = unsymbolize(splitName[2]);
					}
					backFace = backFace.replace(splitName[0], "");
				}
				let splitTypeLine = backFace.match(/^(?:\*\*)?([^(\n]+) *\n?\(([^)]+)?\)(?:\*\*)?\n/);
				if(splitTypeLine) { //pull out typeline and rarity
					let splitType = splitTypeLine[1].split(/ [—~] /);
					cardData.super_type_2 = splitType[0];
					if(splitType[1])
						cardData.sub_type_2 = splitType[1];
					backFace = backFace.replace(splitTypeLine[0], "") //remove it from the value
				}
				backFace = backFace.replace(/\n~~\n.*/, "")	//remove card notes
				backFace = backFace.replace(/\n+$/, "");	//remove any trailing linebreaks
				let ptMatch = backFace.match(/(?:\n|^)\(?(\d+)\/(\d+)\)?$/);
				if(ptMatch) { //has a pt
					cardData.power_2 = ptMatch[1];
					cardData.toughness_2 = ptMatch[2];
					backFace = backFace.replace(ptMatch[0], "");
				}
				cardData.rule_text_2 = unsymbolize(backFace.replace(/\n​?$/, "").replace(/@/g, "CARDNAME").replace(/~/g, "—")); //everything else is rules text
				//guess the stylesheet
				if(cardData.super_type.match(/Instant|Sorcery/) && cardData.super_type_2.match(/Instant|Sorcery/)) {
					cardData.stylesheet = "m15-split-fusable"
				}else{
					cardData.stylesheet = "m15-mainframe-dfc";
				}
				if(cardData.casting_cost_2)
					cardData.styling_data = {
						dfc_type: "modal with standard flags"
					}

			}
			output += MSECardWriter(cardData); //convert to MSE card data
		}
		zipTech.editZip('quarantine/neural_output.mse-set', 'set', function(content) {
				return content + "\n" + output;
			}, function() {
				if(!chan)
					return;
				chan.send({
					files: [{attachment:"./quarantine/neural_output.mse-set", name:"neural_output.mse-set"}]
					})
			}
		);
	});
}
function unsymbolize(card) {								//converts emotes and symbols to letters
	//convert emotes
	//emotes are formatted <:M_:1234> or <:manam:1234>
	card = card.replace(/<:(?:mana)?([0-9CWUBRGSETQAPXY]+)_?:\d+>/gi, function(v) {
		v = v.replace(/^<:(mana)?/, "");
		v = v.replace(/_?:\d+>$/, "");
		return "{" + v.toUpperCase() + "}"
	});
	
	card = card.replace(/} {/g, "}{"); //remove spaces between emotes
	card = card.replace(/\{([0-9CWUBRGS])([CWUBRGSP])}/g, "{$1/$2}") //add hybrid slashes to emotes
	card = card.replace(/[{}]/g, ""); //remove {s
	card = card.replace(/[([]([0-9WUBRGPHCSEAQ]\/?[WUBRGPHCSEAQP]?)[)\]]/g, "$1"); //remove () and [] but only around mana symbols
	return card;
}
function MSECardWriter(cardData) {							//converts card object to MSE data
	let output = "card:\n";
	if(cardData.stylesheet)
		output += `\tstylesheet: ${cardData.stylesheet}\n`;
	if(Object.keys(cardData.styling_data).length) {
		output += `\thas styling: true\n`;
		output += `\tstyling data:\n`;
		for(let v in cardData.styling_data)
			output += `\t\t${v}: ${cardData.styling_data[v]}\n`;
	}else{
		output += `\thas styling: false\n`;
	}
	let remainingFields = [
		"notes",
		"border_color",
		"name",
		"casting_cost",
		"indicator",
		"super_type",
		"sub_type",
		"rarity",
		"rule_text",
		"flavor_text",
		"level_1_text",
		"level_2_text",
		"level_3_text",
		"level_4_text",
		"image",
		"mainframe_image",
		"image_2",
		"power",
		"toughness",
		"loyalty",
		"illustrator",
		"name_2",
		"casting_cost_2",
		"super_type_2",
		"sub_type_2",
		"rule_text_2",
		"flavor_text_2",
		"level_5_text",
		"level_6_text",
		"level_7_text",
		"level_8_text",
		"mainframe_image",
		"image_2",
		"power_2",
		"toughness_2",
		"loyalty_2",
		"illustrator_2",
		"rule_text_3",
		"card_code_text"
	]
	for(let field in remainingFields) {
		if(cardData[remainingFields[field]]) {
			if(cardData[remainingFields[field]].match(/\n/)) {
				output += `\t${remainingFields[field]}:\n`
				let lines = cardData[remainingFields[field]].split("\n");
				for(let l in lines) {
					if(lines[l] != "")
						output += `\t\t${lines[l]}\n`;
				}
			}else{
				output += `\t${remainingFields[field]}: ${cardData[remainingFields[field]]}\n`;
			}
		}
	}
	return output;
}

let testMessages = [										//testing posts
	"https://discord.com/channels/733313820499640322/733313821153689622/869749367572144168",
	"https://discord.com/channels/733313820499640322/785291585574273024/870443656966975498"
]
async function translateFromLinks(messArray) {				//pull all cards from array of message links
	let cards = []
	for(let m in messArray) {
		let testMessage = await getMessageFromLink(messArray[m]);
		let messEmbed = testMessage.embeds[0];
		for(let f in messEmbed.fields)
			cards.push(messEmbed.fields[f])
	}
	nnTranslator(cards)//, channel_to_post_finished-file) //optionally send the finished file to a channel
}
function getMessageFromLink(discLink) {						//return a message object from a discord link
	let numbers = discLink.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
	if(!numbers)
		return {error:"Invalid link"}
	let message = Client.channels.cache.get(numbers[2]).messages.fetch(numbers[3]);
	return message;
}

exports.translator = nnTranslator;
exports.pullAll = pullAll;
exports.translateFromLinks = translateFromLinks;