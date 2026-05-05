const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Web server running');
});
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// Create client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Data storage
let data = { members: {}, panel: null };

// Load data.json if exists
if (fs.existsSync('./data.json')) {
  const saved = JSON.parse(fs.readFileSync('./data.json'));
  data.members = saved.members || {};
  data.panel = saved.panel || null;
}

// Save function
function saveData() {
  fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

// Format names
function formatName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Build embed
function buildEmbed() {
  let maxed = [];
  let complete = [];
  let incomplete = [];

  for (let name in data.members) {
    let q = data.members[name];
    let displayName = formatName(name);

    if (q === 24) maxed.push(`✨ **${displayName}** - 24/24`);
    else if (q >= 18) complete.push(`✅ **${displayName}** - ${q}/24`);
    else incomplete.push(`⚪ **${displayName}** - ${q}/24`);
  }

  const embed = new EmbedBuilder()
    .setTitle("🌼 Quest Tracker")
    .setColor(0xFFD700)
    .addFields(
      { name: "✨ Maxed", value: maxed.join('\n') || "None", inline: false },
      { name: "✅ Complete", value: complete.join('\n') || "None", inline: false },
      { name: "⚪ Incomplete", value: incomplete.join('\n') || "None", inline: false }
    );

  return embed;
}

// When bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Handle interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const name = interaction.options.getString('name').toLowerCase();
    const amount = interaction.options.getInteger('amount');

    data.members[name] = amount;
    saveData();

    await interaction.reply(`✅ Added **${formatName(name)}** with ${amount}/24`);
  }

  if (sub === 'remove') {
    const name = interaction.options.getString('name').toLowerCase();

    if (!(name in data.members)) {
      return interaction.reply(`❌ ${formatName(name)} is not in tracker`);
    }

    delete data.members[name];
    saveData();

    await interaction.reply(`🗑 Removed **${formatName(name)}**`);
  }

  if (sub === 'status') {
    await interaction.reply({ embeds: [buildEmbed()] });
  }

  if (sub === 'reset') {
    data.members = {};
    saveData();

    await interaction.reply("♻️ Tracker reset");
  }
});

// 🔑 THIS IS THE IMPORTANT PART
client.login(process.env.TOKEN);
