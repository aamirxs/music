const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Get user profile and settings
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password')
            .populate('favorites')
            .populate('playlists')
            .populate('recentlyPlayed');
            
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching profile' 
        });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        const userId = req.userId;

        // Check if email is already taken by another user
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Email is already in use' 
                });
            }
        }

        // Prepare update object
        const updateData = {};
        if (fullName) updateData.fullName = fullName;
        if (email) updateData.email = email;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            data: user 
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating profile' 
        });
    }
});

// Update user settings
router.put('/settings', auth, async (req, res) => {
    try {
        const { theme, volume, autoplay } = req.body;
        const user = await User.findByIdAndUpdate(
            req.userId,
            { 
                $set: { 
                    'settings.theme': theme,
                    'settings.volume': volume,
                    'settings.autoplay': autoplay
                }
            },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating settings' 
        });
    }
});

// Add to favorites
router.post('/favorites', auth, async (req, res) => {
    try {
        const { songId, name, artist, imageUrl, downloadUrl } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if song already in favorites
        if (user.favorites.some(fav => fav.songId === songId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Song already in favorites' 
            });
        }

        user.favorites.push({ songId, name, artist, imageUrl, downloadUrl });
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Added to favorites',
            data: user.favorites 
        });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding to favorites' 
        });
    }
});

// Remove from favorites
router.delete('/favorites/:songId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        user.favorites = user.favorites.filter(fav => fav.songId !== req.params.songId);
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Removed from favorites',
            data: user.favorites 
        });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error removing from favorites' 
        });
    }
});

// Get user's playlists
router.get('/playlists', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            data: user.playlists 
        });
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching playlists' 
        });
    }
});

// Create playlist
router.post('/playlists', auth, async (req, res) => {
    try {
        const { name } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        user.playlists.push({ name, songs: [] });
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Playlist created',
            data: user.playlists 
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating playlist' 
        });
    }
});

// Add song to playlist
router.post('/playlists/:playlistId/songs', auth, async (req, res) => {
    try {
        const { songId, name, artist, imageUrl, downloadUrl } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const playlist = user.playlists.id(req.params.playlistId);
        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist not found' 
            });
        }

        // Check if song already in playlist
        if (playlist.songs.some(song => song.songId === songId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Song already in playlist' 
            });
        }

        playlist.songs.push({ songId, name, artist, imageUrl, downloadUrl });
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Song added to playlist',
            data: playlist 
        });
    } catch (error) {
        console.error('Add to playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding song to playlist' 
        });
    }
});

// Remove song from playlist
router.delete('/playlists/:playlistId/songs/:songId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const playlist = user.playlists.id(req.params.playlistId);
        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist not found' 
            });
        }

        playlist.songs = playlist.songs.filter(song => song.songId !== req.params.songId);
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Song removed from playlist',
            data: playlist 
        });
    } catch (error) {
        console.error('Remove from playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error removing song from playlist' 
        });
    }
});

// Delete playlist
router.delete('/playlists/:playlistId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        user.playlists = user.playlists.filter(playlist => 
            playlist._id.toString() !== req.params.playlistId
        );
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Playlist deleted',
            data: user.playlists 
        });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting playlist' 
        });
    }
});

// Add to recently played
router.post('/recently-played', auth, async (req, res) => {
    try {
        const { songId, name, artist, imageUrl, downloadUrl } = req.body;
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Remove the song if it already exists in recently played
        user.recentlyPlayed = user.recentlyPlayed.filter(song => song.songId !== songId);
        
        // Add to the beginning of the array
        user.recentlyPlayed.unshift({ 
            songId, 
            name, 
            artist, 
            imageUrl, 
            downloadUrl,
            playedAt: new Date()
        });
        
        // Keep only the last 20 songs
        if (user.recentlyPlayed.length > 20) {
            user.recentlyPlayed = user.recentlyPlayed.slice(0, 20);
        }
        
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Recently played updated',
            data: user.recentlyPlayed 
        });
    } catch (error) {
        console.error('Recently played error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating recently played' 
        });
    }
});

module.exports = router;
