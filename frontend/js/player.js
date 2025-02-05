// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');
const volumeIcon = document.getElementById('volumeIcon');
const volumeSlider = document.getElementById('volumeSlider');
const progressBarContainer = document.getElementById('progressBarContainer');
const playlistsContainer = document.getElementById('playlistsContainer');

let currentPlaylist = [];
let currentSongIndex = 0;

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userSection = document.getElementById('userSection');
    const authSection = document.getElementById('authSection');
    
    if (!token) {
        window.location.href = '/login';
        return;
    }
    
    userSection.classList.remove('hidden');
    authSection.classList.add('hidden');
    
    // Display user name if available
    if (user.fullName) {
        document.getElementById('userName').textContent = `Welcome, ${user.fullName}`;
    }
}

// Add authentication headers to all API requests
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    const headers = {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, { 
            ...options, 
            headers 
        });
        
        if (response.status === 401) {
            console.error('Authentication failed:', await response.text());
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
        }
        
        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// Search functionality
searchInput.addEventListener('input', debounce(searchSongs, 500));

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function searchSongs() {
    const query = searchInput.value.trim();
    if (!query) {
        searchResults.innerHTML = '';
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/music/search?query=${encodeURIComponent(query)}`);
        if (!response) return;
        
        const data = await response.json();
        
        if (data.success && data.data.results) {
            displaySearchResults(data.data.results);
        }
    } catch (error) {
        console.error('Error searching songs:', error);
    }
}

function displaySearchResults(songs) {
    searchResults.innerHTML = songs.map((song, index) => `
        <div class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
            <img src="${song.image[2]?.url || song.image[0]?.url}" alt="${song.name}" class="w-full h-48 object-cover rounded-md mb-4">
            <h3 class="font-semibold text-lg mb-2">${song.name}</h3>
            <p class="text-gray-600 mb-4">${song.artists.primary[0].name}</p>
            <button 
                onclick="playSong(${index})"
                class="bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors w-full"
            >
                Play
            </button>
            <button 
                onclick="toggleFavorite('${song.id}')"
                id="fav-${song.id}"
                class="ml-2 text-gray-500 hover:text-gray-700"
            >
                <i class="fas fa-heart"></i>
            </button>
        </div>
    `).join('');
    
    currentPlaylist = songs;
}

function playSong(index) {
    const song = currentPlaylist[index];
    currentSongIndex = index;
    
    // Update player UI
    document.getElementById('currentSongTitle').textContent = song.name;
    document.getElementById('currentSongArtist').textContent = song.artists.primary[0].name;
    document.getElementById('currentSongImage').src = song.image[2]?.url || song.image[0]?.url;
    
    // Get the highest quality audio URL
    const downloadUrl = song.downloadUrl[0]?.url;
    if (downloadUrl) {
        audioPlayer.src = downloadUrl;
        audioPlayer.play()
            .catch(error => console.error('Playback error:', error));
        updatePlayPauseButton(true);
        updateRecentlyPlayed(song);
    } else {
        console.error('No download URL available for this song');
    }
}

function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play()
            .catch(error => console.error('Playback error:', error));
        updatePlayPauseButton(true);
    } else {
        audioPlayer.pause();
        updatePlayPauseButton(false);
    }
}

function updatePlayPauseButton(isPlaying) {
    playPauseBtn.innerHTML = isPlaying 
        ? '<i class="fas fa-pause"></i>' 
        : '<i class="fas fa-play"></i>';
}

function previousSong() {
    if (currentSongIndex > 0) {
        playSong(currentSongIndex - 1);
    }
}

function nextSong() {
    if (currentSongIndex < currentPlaylist.length - 1) {
        playSong(currentSongIndex + 1);
    }
}

function toggleMute() {
    audioPlayer.muted = !audioPlayer.muted;
    volumeIcon.className = audioPlayer.muted 
        ? 'fas fa-volume-mute' 
        : 'fas fa-volume-up';
}

// Audio player event listeners
audioPlayer.addEventListener('timeupdate', () => {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${progress}%`;
    
    currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
});

audioPlayer.addEventListener('loadedmetadata', () => {
    durationSpan.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('ended', () => {
    nextSong();
});

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Add volume slider event listener
volumeSlider.addEventListener('input', (e) => {
    const volume = parseFloat(e.target.value);
    audioPlayer.volume = volume;
    updateVolumeIcon(volume);
    
    // Save volume setting
    fetchWithAuth('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({ volume })
    });
});

// Add progress bar seeking
progressBarContainer.addEventListener('click', (e) => {
    const rect = progressBarContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = pos * audioPlayer.duration;
});

// Add to favorites
async function toggleFavorite(songId) {
    try {
        const song = currentPlaylist.find(s => s.id === songId);
        if (!song) return;

        const isFavorite = document.getElementById(`fav-${songId}`).classList.contains('text-red-500');
        
        if (isFavorite) {
            await fetchWithAuth(`/api/user/favorites/${songId}`, {
                method: 'DELETE'
            });
            document.getElementById(`fav-${songId}`).classList.remove('text-red-500');
        } else {
            await fetchWithAuth('/api/user/favorites', {
                method: 'POST',
                body: JSON.stringify({
                    songId: song.id,
                    name: song.name,
                    artist: song.artists.primary[0].name,
                    imageUrl: song.image[2]?.url || song.image[0]?.url,
                    downloadUrl: song.downloadUrl[0]?.url
                })
            });
            document.getElementById(`fav-${songId}`).classList.add('text-red-500');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
    }
}

// Add to playlist
async function addToPlaylist(songId, playlistId) {
    try {
        const song = currentPlaylist.find(s => s.id === songId);
        if (!song) return;

        await fetchWithAuth(`/api/user/playlists/${playlistId}/songs`, {
            method: 'POST',
            body: JSON.stringify({
                songId: song.id,
                name: song.name,
                artist: song.artists.primary[0].name,
                imageUrl: song.image[2]?.url || song.image[0]?.url,
                downloadUrl: song.downloadUrl[0]?.url
            })
        });
        
        alert('Song added to playlist!');
    } catch (error) {
        console.error('Error adding to playlist:', error);
    }
}

// Create new playlist
async function createPlaylist() {
    const name = prompt('Enter playlist name:');
    if (!name) return;

    try {
        await fetchWithAuth('/api/user/playlists', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        
        loadPlaylists(); // Refresh playlists
    } catch (error) {
        console.error('Error creating playlist:', error);
    }
}

// Load user's playlists
async function loadPlaylists() {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const playlists = data.data.playlists;
            const playlistsContainer = document.getElementById('playlistsContainer');
            
            playlistsContainer.innerHTML = playlists.map(playlist => `
                <div class="bg-white p-4 rounded-lg shadow mb-4">
                    <h3 class="font-semibold text-lg mb-2">${playlist.name}</h3>
                    <p class="text-gray-600 mb-4">${playlist.songs.length} songs</p>
                    <button 
                        onclick="playPlaylist('${playlist._id}')"
                        class="bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors"
                    >
                        Play
                    </button>
                    <button 
                        onclick="deletePlaylist('${playlist._id}')"
                        class="ml-2 text-red-500 hover:text-red-700"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

// Play a playlist
async function playPlaylist(playlistId) {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const playlist = data.data.playlists.find(p => p._id === playlistId);
            if (playlist && playlist.songs.length > 0) {
                currentPlaylist = playlist.songs;
                currentSongIndex = 0;
                playSong(0);
            }
        }
    } catch (error) {
        console.error('Error playing playlist:', error);
    }
}

// Delete a playlist
async function deletePlaylist(playlistId) {
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    
    try {
        await fetchWithAuth(`/api/user/playlists/${playlistId}`, {
            method: 'DELETE'
        });
        
        loadPlaylists(); // Refresh playlists
    } catch (error) {
        console.error('Error deleting playlist:', error);
    }
}

// Update recently played
async function updateRecentlyPlayed(song) {
    try {
        await fetchWithAuth('/api/user/recently-played', {
            method: 'POST',
            body: JSON.stringify({
                songId: song.id,
                name: song.name,
                artist: song.artists.primary[0].name,
                imageUrl: song.image[2]?.url || song.image[0]?.url,
                downloadUrl: song.downloadUrl[0]?.url
            })
        });
    } catch (error) {
        console.error('Error updating recently played:', error);
    }
}

// Load user settings
async function loadUserSettings() {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const { volume, theme, autoplay } = data.data.settings;
            
            // Apply volume
            audioPlayer.volume = volume;
            volumeSlider.value = volume;
            updateVolumeIcon(volume);
            
            // Apply theme
            document.body.classList.toggle('dark', theme === 'dark');
            
            // Apply autoplay
            audioPlayer.autoplay = autoplay;
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
    }
}

// Update volume icon based on volume level
function updateVolumeIcon(volume) {
    if (volume === 0) {
        volumeIcon.className = 'fas fa-volume-mute';
    } else if (volume < 0.5) {
        volumeIcon.className = 'fas fa-volume-down';
    } else {
        volumeIcon.className = 'fas fa-volume-up';
    }
}

// Initialize everything
async function initialize() {
    await checkAuth();
    await loadUserSettings();
    await loadPlaylists();
}

initialize();
