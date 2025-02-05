const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Search songs
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const response = await axios.get(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`);
        
        // Filter and modify the response to only include high-quality URLs
        if (response.data.data && response.data.data.results) {
            response.data.data.results = response.data.data.results.map(song => {
                // Get the highest quality download URL available
                const downloadUrls = song.downloadUrl || [];
                const highestQualityUrl = downloadUrls.reduce((prev, current) => {
                    const prevQuality = parseInt(prev.quality.replace('kbps', ''));
                    const currentQuality = parseInt(current.quality.replace('kbps', ''));
                    return currentQuality > prevQuality ? current : prev;
                }, downloadUrls[0]);

                // Get the highest quality image
                const images = song.image || [];
                const highestQualityImage = images[images.length - 1] || images[0];

                return {
                    id: song.id,
                    name: song.name,
                    artists: song.artists,
                    duration: song.duration,
                    image: highestQualityImage ? [highestQualityImage] : song.image,
                    downloadUrl: highestQualityUrl ? [highestQualityUrl] : song.downloadUrl
                };
            });
        }
        
        res.json(response.data);
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ message: 'Error fetching songs', error: error.message });
    }
});

// Get song details
router.get('/song/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'Song ID is required' });
        }

        const response = await axios.get(`https://saavn.dev/api/songs?id=${id}`);
        
        // Ensure high quality audio URL
        if (response.data.data && response.data.data.length > 0) {
            response.data.data = response.data.data.map(song => {
                const downloadUrls = song.downloadUrl || [];
                const highestQualityUrl = downloadUrls.reduce((prev, current) => {
                    const prevQuality = parseInt(prev.quality.replace('kbps', ''));
                    const currentQuality = parseInt(current.quality.replace('kbps', ''));
                    return currentQuality > prevQuality ? current : prev;
                }, downloadUrls[0]);

                // Get the highest quality image
                const images = song.image || [];
                const highestQualityImage = images[images.length - 1] || images[0];

                return {
                    ...song,
                    image: highestQualityImage ? [highestQualityImage] : song.image,
                    downloadUrl: highestQualityUrl ? [highestQualityUrl] : song.downloadUrl
                };
            });
        }
        
        res.json(response.data);
    } catch (error) {
        console.error('Song details error:', error.message);
        res.status(500).json({ message: 'Error fetching song details', error: error.message });
    }
});

module.exports = router;
