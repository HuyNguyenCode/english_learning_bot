require("dotenv").config();
const cron = require("node-cron");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // chú ý dòng này
    GatewayIntentBits.DirectMessages,
  ],
});

const flashcardSessions = new Map();
const hangmanSessions = new Map();
const spellingbeeSessions = new Map();
const userScores = new Map(); // userID -> score
const subscribers = new Set(); // for /subscribe
const speakingSessions = new Map();
const challengeSessions = new Map();

client.once("ready", () => {
  console.log(`🤖 Bot ${client.user.tag} is online!`);
});

// ========== Utility ==========
function updateUserScore(userId, point) {
  const current = userScores.get(userId) || 0;
  userScores.set(userId, current + point);
}

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return; // tránh bot trả lời chính nó

  // /wordoftheday
  if (msg.content === "/wordoftheday") {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'Generate a random English word of the day with its meaning and an example sentence. Respond only in JSON like: {"word":"...","meaning":"...","example":"..."}',
            },
            {
              role: "user",
              content: "Give me the word of the day.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`📚 Word of the Day: ${data.word}`)
        .setDescription(
          `**Meaning:** ${data.meaning}\n**Example:** ${data.example}`
        )
        .setColor("Random");

      msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Error fetching word of the day:", err.message);
      msg.reply("❌ Không thể lấy Word of the Day từ AI.");
    }
  }
  //define [word]
  if (msg.content.startsWith("/define ")) {
    const word = msg.content.slice(8).trim();
    if (!word) return msg.reply("❌ Bạn cần nhập một từ để tra nghĩa.");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'You are a helpful English dictionary assistant. Given a word, respond only in JSON like: {"word":"...","meaning":"...","example":"..."}',
            },
            {
              role: "user",
              content: `Define this word: ${word}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`📖 Definition: ${data.word}`)
        .setDescription(
          `**Meaning:** ${data.meaning}\n**Example:** ${data.example}`
        )
        .setColor("Blue");

      msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Error defining word:", err.message);
      msg.reply("❌ Không thể lấy định nghĩa từ AI.");
    }
  }
  // wordfamily
  if (msg.content.startsWith("/wordfamily ")) {
    const word = msg.content.slice(12).trim();
    if (!word) return msg.reply("❌ Bạn cần nhập một từ để tra family words.");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                `You are an English linguist. When given a word, respond ONLY in JSON format containing family words (noun, verb, adjective, adverb). For example:\n` +
                `{\n  "word": "beauty",\n  "noun": "beauty",\n  "verb": "beautify",\n  "adjective": "beautiful",\n  "adverb": "beautifully"\n}`,
            },
            {
              role: "user",
              content: `Give me the word family for "${word}"`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`👪 Word Family: ${data.word}`)
        .addFields(
          { name: "📘 Noun", value: data.noun || "None", inline: true },
          { name: "🔨 Verb", value: data.verb || "None", inline: true },
          {
            name: "🎨 Adjective",
            value: data.adjective || "None",
            inline: true,
          },
          { name: "🏃 Adverb", value: data.adverb || "None", inline: true }
        )
        .setColor("DarkGreen");

      msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Error getting word family:", err.message);
      msg.reply("❌ Không thể lấy từ cùng họ từ AI.");
    }
  }

  //synonyms [word]
  if (msg.content.startsWith("/synonyms ")) {
    const word = msg.content.slice(10).trim();
    if (!word) return msg.reply("❌ Bạn cần nhập một từ để tra từ đồng nghĩa.");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'You are an English assistant. When given a word, respond only in JSON format like:\n{\n  "word": "happy",\n  "meaning": "feeling or showing pleasure or contentment",\n  "synonyms": ["joyful", "cheerful", "content"],\n  "antonyms": ["sad", "unhappy", "miserable"]\n}',
            },
            {
              role: "user",
              content: `Give me meaning, synonyms, and antonyms for the word: ${word}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Word: ${data.word}`)
        .setDescription(`**Meaning:** ${data.meaning}`)
        .addFields(
          { name: "🔁 Synonyms", value: data.synonyms.join(", ") || "None" },
          { name: "🚫 Antonyms", value: data.antonyms.join(", ") || "None" }
        )
        .setColor("DarkAqua");

      msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Error fetching synonyms:", err.message);
      msg.reply("❌ Không thể lấy thông tin từ AI.");
    }
  }

  // /grammar [chủ đề]
  if (msg.content.startsWith("/grammar ")) {
    const topic = msg.content.slice(9).trim();

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'You are an English grammar teacher. When given a topic, return a short explanation and one example sentence. Respond ONLY in JSON like: {"explanation": "...", "example": "..."}',
            },
            {
              role: "user",
              content: `Explain this grammar topic: ${topic}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`📘 Grammar: ${topic}`)
        .setDescription(
          `**Explanation:** ${data.explanation}\n**Example:** ${data.example}`
        )
        .setColor("Blue");
      msg.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      msg.reply("❌ Không thể lấy dữ liệu từ AI.");
    }
  }

  // /quizgrammar
  if (msg.content === "/quizgrammar") {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'You are an English teacher. Generate a multiple choice grammar quiz. Respond only in JSON like:\n{"question":"...","choices":["...","...","..."],"answer":1,"explanation":"..."}',
            },
            {
              role: "user",
              content: "Give me one grammar quiz question.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const quiz = JSON.parse(res.data.choices[0].message.content);
      const embed = new EmbedBuilder()
        .setTitle("🧠 Grammar Quiz")
        .setDescription(
          `${quiz.question}\n\nA) ${quiz.choices[0]}\nB) ${quiz.choices[1]}\nC) ${quiz.choices[2]}\n\n⏳ Vui lòng trả lời bằng A, B hoặc C trong vòng 15 giây.`
        )
        .setColor("Green");

      await msg.channel.send({ embeds: [embed] });

      const filter = (response) =>
        response.author.id === msg.author.id &&
        ["a", "b", "c"].includes(response.content.toLowerCase());

      msg.channel
        .awaitMessages({ filter, max: 1, time: 15000, errors: ["time"] })
        .then((collected) => {
          const userAnswer = collected.first().content.toLowerCase();
          const correctIndex = quiz.answer;
          const correctLetter = ["a", "b", "c"][correctIndex];

          if (userAnswer === correctLetter) {
            msg.reply(`🎉 Chính xác! ${quiz.explanation}`);
            updateUserScore(msg.author.id, 1);
          } else {
            msg.reply(
              `❌ Wrong answer. The correct answer is **${correctLetter.toUpperCase()}**: ${
                quiz.choices[correctIndex]
              }\n${quiz.explanation}`
            );
          }
        })
        .catch(() => {
          msg.reply("⏰ Hết thời gian trả lời.");
        });
    } catch (err) {
      console.error(err);
      msg.reply("❌ Không thể lấy câu hỏi từ AI.");
    }
  }

  // /pronounce [word]
  if (msg.content.startsWith("/pronounce ")) {
    const word = msg.content.split(" ")[1];
    if (!word) return msg.reply("❌ Hãy nhập từ cần phát âm.");

    try {
      const res = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
      );
      const phonetics = res.data[0].phonetics;

      const ipa =
        phonetics.find((p) => p.text)?.text || "Không tìm thấy phiên âm IPA.";

      const embed = new EmbedBuilder()
        .setTitle(`🔡 Pronunciation of "${word}"`)
        .setDescription(`**IPA:** ${ipa}`)
        .setColor("Aqua");

      msg.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("❌ Lỗi lấy phiên âm:", err.message);
      msg.reply("❌ Không tìm thấy phiên âm cho từ này.");
    }
  }

  // /conversationtopic
  if (msg.content === "/conversationtopic") {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'Generate one English conversation topic with a question and a sample answer. Respond only in JSON like: {"topic":"...","question":"...","answer":"..."}',
            },
            {
              role: "user",
              content: "Give me a random English conversation topic.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`💬 Conversation Topic: ${data.topic}`)
        .addFields(
          { name: "Question", value: data.question },
          { name: "Sample Answer", value: data.answer }
        )
        .setColor("Purple");

      msg.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      msg.reply("❌ Không thể lấy dữ liệu từ AI.");
    }
  }

  // /dailyconversation
  if (msg.content === "/dailyconversation") {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'Create a short, realistic English conversation (3-5 lines) between two people on a daily life topic. Also give a title. Respond only in JSON like: {"title":"...","dialogue":"A: ...\\nB: ...\\nA: ..."}',
            },
            {
              role: "user",
              content: "Generate a daily English conversation.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = JSON.parse(res.data.choices[0].message.content);

      const embed = new EmbedBuilder()
        .setTitle(`🗣️ Daily Conversation: ${data.title}`)
        .setDescription(data.dialogue)
        .setColor("Orange");

      msg.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      msg.reply("❌ Không thể lấy đoạn hội thoại từ AI.");
    }
  }

  // /correct [text]
  if (msg.content.startsWith("/correct ")) {
    const input = msg.content.slice(9).trim();
    if (!input) return msg.reply("❌ Vui lòng nhập đoạn văn cần sửa.");

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                "You are an English teacher. Correct grammar and explain mistakes.",
            },
            {
              role: "user",
              content: input,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": process.env.YOUR_SITE_URL || "https://example.com",
            "X-Title": process.env.YOUR_SITE_NAME || "EnglishBot",
            "Content-Type": "application/json",
          },
        }
      );
      const reply = response.data.choices[0].message.content;
      msg.reply(`📝 Correction:\n${reply}`);
    } catch (err) {
      console.error("❌ GPT API error:", err.message);
      msg.reply("❌ Có lỗi xảy ra khi chỉnh sửa đoạn văn.");
    }
  }

  // /paraphrase [text]
  if (msg.content.startsWith("/paraphrase ")) {
    const input = msg.content.slice(11).trim();
    if (!input) return msg.reply("❌ Vui lòng nhập câu cần diễn đạt lại.");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct", // Hoặc "google/gemma-7b-it"
          messages: [
            {
              role: "system",
              content:
                "You are an English tutor helping students rewrite sentences in different ways with the same meaning.",
            },
            {
              role: "user",
              content: `Paraphrase this sentence: ${input}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": process.env.YOUR_SITE_URL || "https://example.com", // Tuỳ chọn
            "X-Title": process.env.YOUR_SITE_NAME || "EnglishBot", // Tuỳ chọn
            "Content-Type": "application/json",
          },
        }
      );

      const reply = res.data.choices[0].message.content;
      msg.reply(`✏️ Paraphrased version:\n${reply}`);
    } catch (err) {
      console.error("❌ GPT API error:", err.message);
      msg.reply("❌ Có lỗi xảy ra khi diễn đạt lại câu.");
    }
  }

  // /flashcards start
  // ✅ /flashcards start
  if (msg.content === "/flashcards start") {
    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                'You are an English teacher. Generate a vocabulary flashcard. Respond in **only JSON format** as below:\n\n{\n  "word": "example",\n  "options": ["correct meaning", "wrong 1", "wrong 2"],\n  "correctAnswer": 0\n}',
            },
            {
              role: "user",
              content: "Flashcard please.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const choices = res.data?.choices;
      if (!choices || !choices[0]?.message?.content) {
        return msg.reply("❌ Không thể nhận dữ liệu hợp lệ từ AI.");
      }

      let json;
      try {
        json = JSON.parse(choices[0].message.content);
      } catch (e) {
        console.error("❌ JSON parse error:", e.message);
        return msg.reply("❌ AI trả về dữ liệu không hợp lệ.");
      }

      if (
        !json.word ||
        !Array.isArray(json.options) ||
        typeof json.correctAnswer !== "number"
      ) {
        return msg.reply("❌ Flashcard không hợp lệ.");
      }

      flashcardSessions.set(msg.author.id, {
        word: json.word,
        answer: json.correctAnswer,
      });

      msg.channel.send(
        `📚 **Flashcard**\nWhat does **${json.word}** mean?\n\nA) ${json.options[0]}\nB) ${json.options[1]}\nC) ${json.options[2]}\n\n👉 Reply with A, B, or C`
      );
    } catch (err) {
      console.error("❌ Flashcard error:", err.message);
      msg.reply("❌ Có lỗi xảy ra khi tạo flashcard.");
    }
  }

  // ✅ Trả lời flashcard
  if (
    ["a", "b", "c"].includes(msg.content.toLowerCase()) &&
    flashcardSessions.has(msg.author.id)
  ) {
    const { answer } = flashcardSessions.get(msg.author.id);
    const userAnswer = msg.content.toLowerCase();
    const answerIndex = ["a", "b", "c"].indexOf(userAnswer);

    if (answerIndex === answer) {
      updateUserScore(msg.author.id, 1);
      msg.reply("🎉 Chính xác!");
    } else {
      const correctLetter = ["A", "B", "C"][answer];
      msg.reply(`❌ Sai rồi. Đáp án đúng là **${correctLetter}**.`);
    }

    flashcardSessions.delete(msg.author.id);
  }
  // /hangman
  if (msg.content === "/hangman") {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content:
              'Choose a random English word (5-8 letters). Respond ONLY with JSON like: {"word":"planet"}. No explanation.',
          },
          {
            role: "user",
            content: "Start hangman",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let word;
    try {
      const raw = res.data.choices[0].message.content;
      console.log("📦 AI response:", raw); // Debug
      word = JSON.parse(raw).word.toLowerCase();
    } catch (err) {
      return msg.reply("❌ Không thể lấy từ cho Hangman.");
    }

    const display = Array(word.length).fill("_");
    hangmanSessions.set(msg.author.id, {
      word,
      display,
      attempts: [],
      wrong: 0,
    });

    msg.channel.send(
      `🎯 **Hangman Game Started!**\nThe word has **${
        word.length
      } letters**.\n${display.join(
        " "
      )}\nWrong guesses: 0/6\n👉 Type a **letter** or try to **guess the whole word**.`
    );
  }

  // === HANGMAN GUESS HANDLING ===
  if (hangmanSessions.has(msg.author.id)) {
    const session = hangmanSessions.get(msg.author.id);
    const input = msg.content.toLowerCase();

    if (input.length === 1 && /^[a-z]$/.test(input)) {
      if (session.attempts.includes(input)) {
        return msg.reply("⚠️ You already guessed that letter.");
      }

      session.attempts.push(input);

      let found = false;
      for (let i = 0; i < session.word.length; i++) {
        if (session.word[i] === input) {
          session.display[i] = input;
          found = true;
        }
      }

      if (!found) session.wrong++;
    } else if (
      /^[a-zA-Z]+$/.test(input) &&
      input.length === session.word.length
    ) {
      // User tries to guess the whole word
      if (input === session.word) {
        msg.reply(`🎉 You guessed it right! The word was **${session.word}**.`);
        updateUserScore(msg.author.id, 1);
        hangmanSessions.delete(msg.author.id); // ✅ THOÁT GAME SAU KHI ĐOÁN ĐÚNG
      } else {
        session.wrong++;
        msg.reply(`❌ **"${input}"** is not the correct word. Try again!`);
      }
    }
    // Check win/lose
    if (session.display.join("") === session.word) {
      msg.reply(`🎉 You win! The word was **${session.word}**.`);
      hangmanSessions.delete(msg.author.id);
    } else if (session.wrong >= 6) {
      msg.reply(`💀 Game over! The word was **${session.word}**.`);
      hangmanSessions.delete(msg.author.id);
    } else {
      msg.channel.send(
        `🔤 ${session.display.join(" ")}\n❌ Wrong: ${
          session.wrong
        }/6\nTried: ${session.attempts.join(", ")}`
      );
    }
  }

  // /spellingbee
  if (msg.content === "/spellingbee") {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content:
              'Choose a common English word (5-8 letters) and provide a short definition. Respond only with JSON like: {"word":"banana","definition":"a yellow fruit"}',
          },
          {
            role: "user",
            content: "Start spellingbee",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let data;
    try {
      data = JSON.parse(res.data.choices[0].message.content);
    } catch (e) {
      return msg.reply("❌ Không thể lấy từ cho Spelling Bee.");
    }

    spellingbeeSessions.set(msg.author.id, data.word);
    msg.channel.send(
      `🔊 **Spelling Bee**\nDefinition: ${data.definition}\n👉 Type the word you hear (guess the spelling).`
    );
  }

  // check spellingbee answer
  else if (
    spellingbeeSessions.has(msg.author.id) &&
    !msg.content.startsWith("/")
  ) {
    const correctWord = spellingbeeSessions.get(msg.author.id);
    if (msg.content.toLowerCase() === correctWord.toLowerCase()) {
      msg.reply(`✅ Correct! The word was **${correctWord}**.`);
      updateUserScore(msg.author.id, 1);
    } else {
      msg.reply(`❌ Incorrect. The correct word was **${correctWord}**.`);
    }
    spellingbeeSessions.delete(msg.author.id);
  }
  // /listenaudio
  // if (msg.content === "/listenaudio") {
  //   const prompt = `Create a short English listening practice (1-2 sentences) followed by a comprehension question. Format JSON: {"sentence":"...","question":"..."}`;

  //   const res = await axios.post(
  //     "https://openrouter.ai/api/v1/chat/completions",
  //     {
  //       model: "mistralai/mistral-7b-instruct",
  //       messages: [
  //         { role: "system", content: "You are a helpful English tutor." },
  //         { role: "user", content: prompt },
  //       ],
  //     },
  //     {
  //       headers: {
  //         Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  //         "Content-Type": "application/json",
  //       },
  //     }
  //   );

  //   const data = JSON.parse(res.data.choices[0].message.content);
  //   const tts = await axios.post(
  //     `https://api.streamelements.com/kappa/v2/speech`,
  //     { voice: "Brian", text: data.sentence },
  //     { responseType: "arraybuffer" }
  //   );

  //   const buffer = Buffer.from(tts.data, "binary");
  //   const attachment = { files: [{ attachment: buffer, name: "audio.mp3" }] };

  //   msg.channel.send(attachment);
  //   msg.channel.send(`❓ **Question:** ${data.question}`);
  // }
  // /dictation
  // if (msg.content === "/dictation") {
  //   const prompt = `Create a short dictation sentence (1 sentence, max 10 words). Return JSON like: {"sentence":"..."}`;

  //   const res = await axios.post(
  //     "https://openrouter.ai/api/v1/chat/completions",
  //     {
  //       model: "mistralai/mistral-7b-instruct",
  //       messages: [{ role: "user", content: prompt }],
  //     },
  //     {
  //       headers: {
  //         Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  //         "Content-Type": "application/json",
  //       },
  //     }
  //   );

  //   const data = JSON.parse(res.data.choices[0].message.content);
  //   const tts = await axios.post(
  //     `https://api.streamelements.com/kappa/v2/speech`,
  //     { voice: "Brian", text: data.sentence },
  //     { responseType: "arraybuffer" }
  //   );

  //   dictationSessions.set(msg.author.id, data.sentence.toLowerCase());

  //   const buffer = Buffer.from(tts.data, "binary");
  //   const attachment = {
  //     files: [{ attachment: buffer, name: "dictation.mp3" }],
  //   };

  //   msg.channel.send(attachment);
  //   msg.channel.send(`✍️ Type what you hear.`);
  // }
  // if (dictationSessions.has(msg.author.id)) {
  //   const correct = dictationSessions.get(msg.author.id);
  //   if (msg.content.toLowerCase().trim() === correct) {
  //     msg.reply("✅ Correct!");
  //   } else {
  //     msg.reply(`❌ Incorrect. The correct sentence was:\n${correct}`);
  //   }
  //   dictationSessions.delete(msg.author.id);
  // }
  // if (msg.content === "/dictation") {
  //   // 1. Gọi GPT để tạo câu ngắn
  //   const gptRes = await axios.post(
  //     "https://openrouter.ai/api/v1/chat/completions",
  //     {
  //       model: "mistralai/mistral-7b-instruct",
  //       messages: [
  //         {
  //           role: "system",
  //           content:
  //             'Generate a short English sentence (5-12 words), simple grammar, suitable for listening dictation. Return ONLY JSON format: {"sentence":"..."}',
  //         },
  //         {
  //           role: "user",
  //           content: "Dictation sentence please.",
  //         },
  //       ],
  //     },
  //     {
  //       headers: {
  //         Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  //         "Content-Type": "application/json",
  //       },
  //     }
  //   );

  //   let sentence;
  //   try {
  //     const parsed = JSON.parse(gptRes.data.choices[0].message.content);
  //     sentence = parsed.sentence;
  //   } catch (err) {
  //     return msg.reply("❌ Không thể tạo câu dictation.");
  //   }

  //   // 2. Gọi ElevenLabs để tạo audio từ câu
  //   const ttsRes = await axios.post(
  //     "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB", // Rachel
  //     {
  //       text: sentence,
  //       model_id: "eleven_monolingual_v1",
  //       voice_settings: {
  //         stability: 0.4,
  //         similarity_boost: 0.7,
  //       },
  //     },
  //     {
  //       headers: {
  //         "xi-api-key": process.env.ELEVENLABS_API_KEY,
  //         "Content-Type": "application/json",
  //       },
  //       responseType: "arraybuffer",
  //     }
  //   );

  //   const buffer = Buffer.from(ttsRes.data, "binary");

  //   // 3. Lưu câu trả lời cho user
  //   msg.channel.send({
  //     content:
  //       "🎧 **Dictation Time!** Listen to the audio and type what you hear:",
  //     files: [{ attachment: buffer, name: "dictation.mp3" }],
  //   });

  //   // 4. Chờ phản hồi người dùng trong vòng 30s
  //   const filter = (m) => m.author.id === msg.author.id;
  //   msg.channel
  //     .awaitMessages({ filter, max: 1, time: 30000, errors: ["time"] })
  //     .then((collected) => {
  //       const reply = collected.first().content.trim().toLowerCase();
  //       const correct = sentence.trim().toLowerCase();

  //       if (reply === correct) {
  //         msg.reply("✅ Chính xác!");
  //       } else {
  //         msg.reply(`❌ Sai rồi. Câu đúng là:\n**${sentence}**`);
  //       }
  //     })
  //     .catch(() => {
  //       msg.reply("⏰ Hết thời gian! Câu đúng là:\n**" + sentence + "**");
  //     });
  // }
  // === /myscore ===
  if (msg.content === "/myscore") {
    const score = userScores.get(msg.author.id) || 0;
    msg.reply(`📊 Your score: **${score}** points.`);
  }

  // === /leaderboard ===
  if (msg.content === "/leaderboard") {
    if (userScores.size === 0) return msg.reply("⚠️ No scores yet.");

    const sorted = [...userScores.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 10);

    const leaderboard = top
      .map(
        (entry, index) =>
          `**${index + 1}.** <@${entry[0]}> – ${entry[1]} points`
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Leaderboard")
      .setDescription(leaderboard)
      .setColor("Gold");

    msg.channel.send({ embeds: [embed] });
  }
  //idiom
  if (msg.content === "/idiom") {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content:
              'Give a random English idiom with its meaning and an example. Format JSON: {"idiom":"...","meaning":"...","example":"..."}',
          },
          {
            role: "user",
            content: "Send me a useful idiom.",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    try {
      const data = JSON.parse(res.data.choices[0].message.content);
      const embed = new EmbedBuilder()
        .setTitle(`📝 Idiom: ${data.idiom}`)
        .setDescription(
          `**Meaning:** ${data.meaning}
**Example:** ${data.example}`
        )
        .setColor("Aqua");
      msg.reply({ embeds: [embed] });
    } catch (err) {
      msg.reply("❌ Không thể lấy idiom từ AI.");
    }
  }
  //phrasal
  if (msg.content === "/phrasal") {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content:
              'Give a random English phrasal verb with its meaning and an example. Format JSON: {"phrasal":"...","meaning":"...","example":"..."}',
          },
          {
            role: "user",
            content: "Send me a useful phrasal verb.",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    try {
      const data = JSON.parse(res.data.choices[0].message.content);
      const embed = new EmbedBuilder()
        .setTitle(`📚 Phrasal Verb: ${data.phrasal}`)
        .setDescription(
          `**Meaning:** ${data.meaning}
  **Example:** ${data.example}`
        )
        .setColor("DarkVividPink");
      msg.reply({ embeds: [embed] });
    } catch (err) {
      msg.reply("❌ Không thể lấy phrasal verb từ AI.");
    }
  }

  // /subscribe and /unsubscribe
  if (msg.content === "/subscribe") {
    subscribers.add(msg.author.id);
    msg.reply("✅ You have successfully subscribed for a daily word or quiz.");
  }
  if (msg.content === "/unsubscribe") {
    subscribers.delete(msg.author.id);
    msg.reply("❌You canceled the registration of daily news.");
  }

  // /speak [topic]
  if (msg.content.startsWith("/speak ")) {
    const topic = msg.content.slice(7).trim();
    if (!topic)
      return msg.reply(
        "❌ Please enter the topic. For example: `/speak travel`"
      );

    // Khởi tạo session
    speakingSessions.set(msg.author.id, [
      {
        role: "system",
        content: `You are a friendly English-speaking teacher. Start a casual 1-on-1 English conversation with the learner on the topic: "${topic}". Ask short questions and reply naturally.`,
      },
    ]);

    const aiRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o",
        max_tokens: 500, // ✅ GIỚI HẠN TOKEN ĐỂ TRÁNH LỖI
        messages: speakingSessions.get(msg.author.id),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botReply = aiRes.data.choices[0].message.content;
    speakingSessions
      .get(msg.author.id)
      .push({ role: "assistant", content: botReply });
    msg.reply(
      `🗣️ ${botReply}\n\n(Phản hồi để tiếp tục, hoặc gõ \`exit\` để kết thúc.)`
    );
    return;
  }

  // Nếu đang trong session speaking
  if (speakingSessions.has(msg.author.id)) {
    const userMsg = msg.content.trim();

    // Thoát
    if (userMsg.toLowerCase() === "exit") {
      speakingSessions.delete(msg.author.id);
      return msg.reply("✅You ended the talk. See you again!");
    }

    const history = speakingSessions.get(msg.author.id);
    history.push({ role: "user", content: userMsg });

    const aiRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o",
        max_tokens: 500, // ✅ GIỚI HẠN TOKEN ĐỂ TRÁNH LỖIclear
        messages: history,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const botReply = aiRes.data.choices[0].message.content;
    history.push({ role: "assistant", content: botReply });

    msg.reply(`💬 ${botReply}\n\n(Type \`exit\`  to end the conversation.)`);
  }

  // /challenge
  if (msg.content === "/challenge") {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content:
              'Generate a short English grammar challenge in JSON. It can be either a fill-in-the-blank or find-the-error type. Format: {"type":"fill" or "error", "question":"...", "choices":[...], "answer":1, "explanation":"..."}',
          },
          {
            role: "user",
            content: "Challenge me!",
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let data;
    try {
      data = JSON.parse(res.data.choices[0].message.content);
    } catch (e) {
      return msg.reply("❌ Can not get minigame from AI.");
    }

    challengeSessions.set(msg.author.id, data);

    const embed = new EmbedBuilder()
      .setTitle("🧩 Minigame Challenge")
      .setDescription(
        `**${data.type === "fill" ? "Fill in the blank" : "Find the error"}**

${data.question}

A) ${data.choices[0]}
B) ${data.choices[1]}
C) ${data.choices[2]}

⏳ Answer with A, B or C for 20 seconds!`
      )
      .setColor("Random");

    await msg.channel.send({ embeds: [embed] });

    const filter = (response) =>
      response.author.id === msg.author.id &&
      ["a", "b", "c"].includes(response.content.toLowerCase());

    msg.channel
      .awaitMessages({ filter, max: 1, time: 20000, errors: ["time"] })
      .then((collected) => {
        const userAnswer = collected.first().content.toLowerCase();
        const correct = ["a", "b", "c"][data.answer];

        if (userAnswer === correct) {
          updateUserScore(msg.author.id, 1);
          msg.reply(`✅ Correct! ${data.explanation}`);
        } else {
          msg.reply(
            `❌ Wrong answer. The correct answer is **${correct.toUpperCase()}**.
${data.explanation}`
          );
        }

        challengeSessions.delete(msg.author.id);
      })
      .catch(() => {
        msg.reply("⏰ Time out!");
        challengeSessions.delete(msg.author.id);
      });
  }
  // /readingpractice
  if (msg.content === "/readingpractice") {
    const loading = await msg.reply("📚 Generating reading practice...");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          max_tokens: 512,
          messages: [
            {
              role: "system",
              content: `Create a short English reading passage (IELTS level ~100 words) and 1 multiple choice question with 3 options (A, B, C). Provide the correct answer and a short explanation. Respond ONLY in JSON like:
{
  "passage": "....",
  "question": "....?",
  "options": ["A ...", "B ...", "C ..."],
  "answer": 1,
  "explanation": "..."
}`,
            },
            {
              role: "user",
              content: "Give me one reading comprehension practice question.",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      let data;
      try {
        data = JSON.parse(res.data.choices[0].message.content);
      } catch (e) {
        return loading.edit("❌Error when analyzing data AI.");
      }

      const embed = new EmbedBuilder()
        .setTitle("📖 Reading Comprehension")
        .setDescription(
          `**Passage:**\n${data.passage}\n\n**Question:** ${data.question}\n\nA) ${data.options[0]}\nB) ${data.options[1]}\nC) ${data.options[2]}\n\n⏳ Answer with A, B or C for 2 minutes.`
        )
        .setColor("Gold");

      await loading.delete();
      await msg.channel.send({ embeds: [embed] });

      const filter = (response) =>
        response.author.id === msg.author.id &&
        ["a", "b", "c"].includes(response.content.toLowerCase());

      msg.channel
        .awaitMessages({ filter, max: 1, time: 120000, errors: ["time"] })
        .then((collected) => {
          const userAnswer = collected.first().content.toLowerCase();
          const correctLetter = ["a", "b", "c"][data.answer];

          if (userAnswer === correctLetter) {
            msg.reply(`✅ Correct!\n📘 ${data.explanation}`);
            updateUserScore(msg.author.id, 1);
          } else {
            msg.reply(
              `❌ Wrong anser. The correct answer is**${correctLetter.toUpperCase()}**.\n📘 ${
                data.explanation
              }`
            );
          }
        })
        .catch(() => {
          msg.reply("⏰ Time out.");
        });
    } catch (err) {
      console.error(err);
      loading.edit("❌Error when calling AI or sending questions.");
    }
  }
  // /translate [text]
  if (msg.content.startsWith("/translate ")) {
    if (msg.content.startsWith("/translate ")) {
      const inputText = msg.content.slice(11).trim();

      const loading = await msg.reply(
        "🔄 Translating and analyzing grammar ..."
      );

      try {
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "mistralai/mistral-7b-instruct",
            messages: [
              {
                role: "system",
                content: `You are a bilingual English-Vietnamese assistant. When given a short English paragraph, return:
1. A fluent Vietnamese translation.
2. 2-3 grammar points used in the paragraph and their explanations.

⚠️ Respond only in the following format, wrapped inside a JSON code block:

\`\`\`json
{
  "translation": "Dịch tiếng Việt...",
  "grammar_points": [
    { "structure": "cấu trúc 1", "explanation": "giải thích 1" },
    { "structure": "cấu trúc 2", "explanation": "giải thích 2" }
  ]
}
\`\`\``,
              },
              {
                role: "user",
                content: inputText,
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        const raw = res.data.choices[0].message.content.trim();

        const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
        if (!jsonMatch) {
          console.error("❌ Không tìm thấy JSON hợp lệ:\n", raw);
          return loading.edit("❌ Không thể phân tích dữ liệu từ AI.");
        }

        let data;
        try {
          data = JSON.parse(jsonMatch[1]);
        } catch (err) {
          console.error("❌ Lỗi khi parse JSON:", err, "\n", jsonMatch[1]);
          return loading.edit("❌ Parse error: Không đọc được phản hồi AI.");
        }

        const embed = new EmbedBuilder()
          .setTitle("🌍 Translation & Grammar Analysis")
          .setDescription(
            `**📄 Original:** ${inputText}\n\n**🇻🇳 Translation:** ${data.translation}`
          )
          .addFields(
            data.grammar_points.map((gp, i) => ({
              name: `📌 Grammar ${i + 1}: ${gp.structure}`,
              value: gp.explanation,
            }))
          )
          .setColor("Blue");

        await loading.delete();
        await msg.channel.send({ embeds: [embed] });
      } catch (error) {
        console.error("❌ Error calling AI or processing:", error);
        loading.edit("❌ Đã xảy ra lỗi khi kết nối hoặc xử lý với AI.");
      }
    }
  }

  if (msg.content.startsWith("/writeessay ")) {
    const topic = msg.content.slice(11).trim();
    if (!topic)
      return msg.reply(
        "❗ You need to enter the topic, for example: ``/writeessay technology"
      );

    const loading = await msg.reply("✍️Creating an IELTS sample essay ...");

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content: `You are an IELTS writing tutor. Given a topic, write a Band 7.5-8.0 level IELTS Task 2 essay (about 250-300 words) with high-level vocabulary. At the end, list 5 advanced words used in the essay and explain them in simple English.`,
            },
            {
              role: "user",
              content: `Topic: ${topic}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = res.data.choices[0].message.content.trim();

      const embed = new EmbedBuilder()
        .setTitle("🪄 IELTS Sample Essay")
        .setDescription(`📌 **Topic:** ${topic}`)
        .setColor("DarkGreen");

      await loading.delete();
      await msg.channel.send({ embeds: [embed] });

      // Nếu content > 2000 ký tự, chia nhỏ để gửi nhiều tin
      const chunks = content.match(/[\s\S]{1,1900}(?=\n|$)/g); // chia nhỏ nhưng cắt ở dòng
      for (const chunk of chunks) {
        await msg.channel.send("```\n" + chunk + "\n```");
      }
    } catch (error) {
      console.error("❌ Error generating essay:", error);
      loading.edit("❌Error occurs when creating essays from AI.");
    }
  }
});

cron.schedule("0 9 * * *", async () => {
  for (const userId of subscribers) {
    try {
      const user = await client.users.fetch(userId);
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content:
                "Give one of the following: 1) a new English word with meaning and example, 2) an idiom, or 3) a quiz with 3 options and correct answer index. Return JSON.",
            },
            {
              role: "user",
              content: "Daily English challenge",
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = res.data.choices[0].message.content;
      await user.send(`📬 **Daily English**
${content}`);
    } catch (err) {
      console.error(`❌ Failed to DM user ${userId}`);
    }
  }
});

const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Route cho UptimeRobot kiểm tra
app.get("/", (req, res) => {
  res.status(200).send("✅ Bot is alive!");
});

app.listen(port, () => {
  console.log(`✅ HTTP server listening on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);
