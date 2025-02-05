const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const playlistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    songs: [{
        songId: String,
        name: String,
        artist: String,
        imageUrl: String,
        downloadUrl: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
});

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    favorites: [{
        songId: String,
        name: String,
        artist: String,
        imageUrl: String,
        downloadUrl: String,
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    playlists: [playlistSchema],
    recentlyPlayed: [{
        songId: String,
        name: String,
        artist: String,
        imageUrl: String,
        downloadUrl: String,
        playedAt: {
            type: Date,
            default: Date.now
        }
    }],
    settings: {
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        },
        volume: {
            type: Number,
            default: 1,
            min: 0,
            max: 1
        },
        autoplay: {
            type: Boolean,
            default: true
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
