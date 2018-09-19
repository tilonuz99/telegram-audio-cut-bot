// Modules
const telegram_bot = require('node-telegram-bot-api');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

// Variables
let users = [];
const regexp = /(\d+):(\d+)\D+(\d+):(\d+)/i;
const token = '/*YOUR BOT TOKEN*/';

// Initialization
const bot = new telegram_bot(token, { polling: true }); // Bot


let add_user = function(chat_id, file_name, seconds_listener) { // Adding an application into the database

	users[users.length] = {
		chat_id: chat_id,
		file_name: file_name,
		seconds_listener: seconds_listener
	}
};

bot.onText(/\/start/i, function(message, match) { // Starting to work with the bot

	bot.sendMessage(message.from.id, 'Привет! Отправь песню, которую ты хочешь обрезать.');
});


bot.onText(/\/help/i, function(message, match) { // Description of how does this bot work

	bot.sendMessage(message.from.id, 'Этот бот может обрезать для тебя песню. Это может быть полезно, например, для создания рингтона. Для начала отправь ее боту.');
});

bot.on('audio', function(message) { // Getting audio handler

	bot.sendMessage(message.from.id, 'Ожидание...');
	bot.downloadFile(message.audio.file_id, "./media/input").then(function(file_name) { // Downloading the file
		
		file_name = file_name.slice(12);
		add_user(message.from.id, file_name, true); // Adding the user into the database
		bot.sendMessage(message.from.id, 'Теперь отправь значения в формате минуты-секунды, когда должна начинаться и заканчиваться песня через тире. Пример: 00:25-02:10');
	});
});

bot.onText(regexp, function(message, match) { // Getting interval handler

	let flag = false; // Flag to check: has an audio been already sent
	let index = 0;

	for (let i = 0; i < users.length; i++) {
		if (users[i].chat_id == message.from.id) { // An audio was sent -> exit from loop
			flag = true;
			index = i; // Adding an index of the application into the database
			break;
		}
	}

	if (flag) { // An audio was sent -> continue the work of handler
		
		let start_minute = parseInt(match[1]); // A minute of the start
		let start_second = parseInt(match[2]); // A second of the start
		let end_minute = parseInt(match[3]); // A minute of the end
		let end_second = parseInt(match[4]); // A second of the end
		
		if (start_second < 60 && end_second < 60) {

			start_second += start_minute * 60; // The start of an audio in seconds
			end_second += end_minute * 60; // The end of an audio in seconds

			if (start_second <= end_second) { 

				bot.sendMessage(message.from.id, 'Обработка...');

				let duration_second = end_second - start_second; // Duration of an audio
				let input_path = 'media/input/' + users[index].file_name; // Path of the original audio
				let output_path = 'media/output/' + users[index].file_name; // Path of the cut audio

				users[index].start_second = start_second; // Adding start second and duration into the database
				users[index].duration_second = duration_second;

				ffmpeg(path.join(process.cwd(), input_path)) // Processing the file
				    .inputFormat('mp3')
				    .audioCodec('libmp3lame')
				    .seekInput(users[index].start_second)
				    .duration(users[index].duration_second)
				    .toFormat('mp3')
				    .on('end', function() { // Конец обработки
				    	bot.sendAudio(message.from.id, path.join(process.cwd(), output_path)).then(function() { // Sending an audio to the user
							fs.unlink(path.join(process.cwd(), input_path), function(error) {
								if (error) {
									console.log('Не удалось удалить файл!');
								}
							});
							fs.unlink(path.join(process.cwd(), output_path), function(error) {
								if (error) {
									console.log('Не удалось удалить файл!');
								}
							});
							users.splice(index, 1); // Removing an application from the database
						});
				    })
				    .save(path.join(process.cwd(), output_path));
				} else if (start_second > end_second) {
					bot.sendMessage(message.from.id, 'Введен некорректный промежуток: время начала песни больше, чем время конца. Отправь правильный промежуток.');
				}
		} else {
			bot.sendMessage(message.from.id, 'Введено некорректное количество секунд: в минуте 60 секунд, то есть максимальное значение может быть равно 59.');
		}

	} else { // User hasn't already sent an audio
		bot.sendMessage(message.from.id, 'Для начала отправьте песню.');
	}
});

setInterval(function() {
	console.log(users);
}, 5000);
