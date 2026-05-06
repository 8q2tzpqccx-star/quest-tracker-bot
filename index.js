require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const DATA_FILE = './data.json';

let data = {
  members: {},
  panelChannelId: null,
  panelMessageId: null
};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
}

if (!data.members) data.members = {};

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function displayName(name) {
  return name
    .trim()
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function cleanMembers() {
  const cleaned = {};

  for (const [name, value] of Object.entries(data.members)) {
    const key = normalizeName(name);

    cleaned[key] = {
      name: typeof value === 'object'
        ? value.name
        : displayName(name),

      count: typeof value === 'object'
        ? value.count
        : value
    };
  }

  data.members = cleaned;
}

cleanMembers();

function saveData() {
  cleanMembers();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function buildEmbed() {
  cleanMembers();

  const maxed = [];
  const complete = [];
  const incomplete = [];

  const members = Object.values(data.members).sort(
    (a, b) => b.count - a.count
  );

  for (const member of members) {
    const line24 = `**${member.name}** — ${member.count}/24`;
    const line18 = `**${member.name}** — ${member.count}/18`;

    if (member.count >= 24) {
      maxed.push(`• ${line24}`);
    } else if (member.count >= 18) {
      complete.push(`• ${line24}`);
    } else {
      incomplete.push(`• ${line18}`);
    }
  }

  const total = members.length;
  const completed = members.filter(m => m.count >= 18).length;

  return new EmbedBuilder()
    .setColor('#f7d84a')
    .setTitle('🌼 Dandelions Guild Quest Tracker')
    .setDescription(`**Completed 18+:** ${completed}/${total}`)

    .addFields(
      {
        name: '🌟 Maxed 24 Quests',
        value: maxed.join('\n') || 'None yet'
      },
      {
        name: '✅ Completed 18–23 Quests',
        value: complete.join('\n') || 'None yet'
      },
      {
        name: '🟡 Not Complete Yet',
        value: incomplete.join('\n') || 'None yet'
      }
    )

    .setFooter({
      text: 'Quest Tracker • 18 complete, 24 max'
    })

    .setTimestamp();
}

async function updatePanel(guild) {
  if (!data.panelChannelId || !data.panelMessageId) return;

  try {
    const channel = await guild.channels.fetch(data.panelChannelId);

    const message = await channel.messages.fetch(
      data.panelMessageId
    );

    await message.edit({
      embeds: [buildEmbed()]
    });

  } catch (err) {
    console.log('Could not update panel:', err.message);
  }
}

const commands = [
  new SlashCommandBuilder()

    .setName('quest')
    .setDescription('Quest tracker commands')

    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Create quest panel')
    )

    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set member quests')

        .addStringOption(option =>
          option
            .setName('member')
            .setDescription('Member name')
            .setRequired(true)
        )

        .addIntegerOption(option =>
          option
            .setName('count')
            .setDescription('Quest count')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove member')

        .addStringOption(option =>
          option
            .setName('member')
            .setDescription('Member name')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Show tracker status')
    )

    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Reset all data')
    )

].map(command => command.toJSON());

client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({
    version: '10'
  }).setToken(process.env.TOKEN);

  try {

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('✅ Slash commands registered');

  } catch (err) {
    console.log('Slash command error:', err.message);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== 'quest') return;

  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();

  if (sub === 'panel') {

    const message = await interaction.channel.send({
      embeds: [buildEmbed()]
    });

    data.panelChannelId = interaction.channel.id;
    data.panelMessageId = message.id;

    saveData();

    return interaction.editReply(
      '✅ Quest panel created.'
    );
  }

  if (sub === 'set') {

    const rawName = interaction.options
      .getString('member')
      .trim();

    const key = normalizeName(rawName);

    const count = interaction.options
      .getInteger('count');

    if (count < 0) {
      return interaction.editReply(
        'Quest count cannot be negative.'
      );
    }

    if (count > 24) {
      return interaction.editReply(
        'Maximum quest count is 24.'
      );
    }

    data.members[key] = {
      name: displayName(rawName),
      count: count
    };

    saveData();

    await interaction.editReply(
      `✅ **${displayName(rawName)}** set to **${count}/24** quests.`
    );

    await updatePanel(interaction.guild);

    return;
  }

  if (sub === 'remove') {

    const rawName = interaction.options
      .getString('member')
      .trim();

    const key = normalizeName(rawName);

    delete data.members[key];

    saveData();

    await interaction.editReply(
      `🗑️ Removed **${displayName(rawName)}** from tracker.`
    );

    await updatePanel(interaction.guild);

    return;
  }

  if (sub === 'status') {

    return interaction.editReply({
      embeds: [buildEmbed()]
    });
  }

  if (sub === 'reset') {

    data.members = {};

    saveData();

    await interaction.editReply(
      '🔄 Quest tracker reset.'
    );

    await updatePanel(interaction.guild);

    return;
  }
});

client.login(process.env.TOKEN);