const express = require('express');
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Web server running');
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let data = { members: {}, panel: null };

if (fs.existsSync('./data.json')) {
  const saved = JSON.parse(fs.readFileSync('./data.json'));
  data.members = saved.members || {};
  data.panel = saved.panel || null;
}

function saveData() {
  fs.writeFileSync('./data.json', JSON.stringify(data, null, 2));
}

function formatName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function buildEmbed() {
  const maxed = [];
  const complete = [];
  const incomplete = [];

  for (const name in data.members) {
    const q = data.members[name];
    const displayName = formatName(name);

    if (q === 24) maxed.push(`🌟 **${displayName}** — 24/24`);
    else if (q >= 18) complete.push(`✅ **${displayName}** — ${q}/24`);
    else incomplete.push(`🟡 **${displayName}** — ${q}/18`);
  }

  const total = Object.keys(data.members).length;
  const done = maxed.length + complete.length;

  return new EmbedBuilder()
    .setColor(0xF7C948)
    .setTitle('🌼 Dandelions Guild Quest Tracker')
    .setDescription(`**Completed 18+:** ${done}/${total}`)
    .addFields(
      { name: '🌟 Maxed 24 Quests', value: maxed.join('\n') || 'None yet' },
      { name: '✅ Completed 18–23 Quests', value: complete.join('\n') || 'None yet' },
      { name: '🟡 Not Complete Yet', value: incomplete.join('\n') || 'None yet' }
    )
    .setFooter({ text: 'Quest Tracker • 18 complete, 24 max' })
    .setTimestamp();
}

async function updatePanel(guild) {
  if (!data.panel) return;

  try {
    const channel = await guild.channels.fetch(data.panel.channelId);
    const message = await channel.messages.fetch(data.panel.messageId);
    await message.edit({ embeds: [buildEmbed()] });
  } catch (err) {
    console.log('Could not update panel:', err.message);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Quest tracker')
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Create the permanent quest tracker panel')
    )
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set quest count')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Member name')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('quests')
            .setDescription('Quest number')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a member from tracker')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Member name')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show quest status once')
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset all quest counts')
    )
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('Slash commands registered');
  } catch (err) {
    console.log('Could not register commands:', err.message);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log('Interaction received:', interaction.commandName);

  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();

  if (sub === 'panel') {
    await interaction.editReply({ embeds: [buildEmbed()] });

    const msg = await interaction.fetchReply();

    data.panel = {
      channelId: interaction.channelId,
      messageId: msg.id
    };

    saveData();
    return;
  }

  if (sub === 'set') {
    const name = interaction.options.getString('name').toLowerCase();
    const quests = interaction.options.getInteger('quests');

    if (quests < 0) return interaction.editReply('Minimum is 0.');
    if (quests > 24) return interaction.editReply('Max is 24.');

    data.members[name] = quests;
    saveData();

    await interaction.editReply(`✅ **${formatName(name)}** set to **${quests}/24** quests.`);
    await updatePanel(interaction.guild);
    return;
  }

  if (sub === 'remove') {
    const name = interaction.options.getString('name').toLowerCase();

    if (!(name in data.members)) {
      return interaction.editReply(`❌ **${formatName(name)}** is not in the tracker.`);
    }

    delete data.members[name];
    saveData();

    await interaction.editReply(`🗑️ Removed **${formatName(name)}** from tracker.`);
    await updatePanel(interaction.guild);
    return;
  }

  if (sub === 'status') {
    return interaction.editReply({ embeds: [buildEmbed()] });
  }

  if (sub === 'reset') {
    data.members = {};
    saveData();

    await interaction.editReply('🔄 Quest tracker has been reset.');
    await updatePanel(interaction.guild);
    return;
  }
});

console.log('TOKEN exists:', !!process.env.TOKEN);
console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('GUILD_ID exists:', !!process.env.GUILD_ID);

client.login(process.env.TOKEN)
  .then(() => console.log('LOGIN SUCCESS'))
  .catch(err => console.log('LOGIN FAILED:', err.message));