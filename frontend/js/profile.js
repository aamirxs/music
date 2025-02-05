// Check authentication on page load
checkAuth();

// Fetch and display user profile data
async function loadProfile() {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const user = data.data;
            updateProfileUI(user);
            loadFavorites();
            loadRecentlyPlayed();
            loadPlaylists();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Update profile UI with user data
function updateProfileUI(user) {
    // Update profile header
    document.getElementById('profileName').textContent = user.fullName;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('memberSince').textContent = `Member since ${new Date(user.createdAt).toLocaleDateString()}`;
    
    // Set profile initials
    const initials = user.fullName
        .split(' ')
        .map(name => name[0])
        .join('')
        .toUpperCase();
    document.getElementById('profileInitials').textContent = initials;
    
    // Update stats
    document.getElementById('favoritesCount').textContent = user.favorites.length;
    document.getElementById('playlistsCount').textContent = user.playlists.length;
    document.getElementById('songsPlayedCount').textContent = user.recentlyPlayed.length;
    
    // Set edit form values
    document.getElementById('editFullName').value = user.fullName;
    document.getElementById('editEmail').value = user.email;
}

// Toggle edit profile form
function toggleEditProfile() {
    const form = document.getElementById('editProfileForm');
    form.classList.toggle('hidden');
}

// Handle profile form submission
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('editFullName').value;
    const email = document.getElementById('editEmail').value;
    const password = document.getElementById('editPassword').value;
    
    try {
        const response = await fetchWithAuth('/api/user/profile', {
            method: 'PUT',
            body: JSON.stringify({
                fullName,
                email,
                password: password || undefined
            })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Profile updated successfully');
            toggleEditProfile();
            loadProfile();
        } else {
            alert(data.message || 'Error updating profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('An error occurred while updating profile');
    }
});

// Load and display favorites
async function loadFavorites() {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const favorites = data.data.favorites;
            const favoritesList = document.getElementById('favoritesList');
            
            favoritesList.innerHTML = favorites.map(song => `
                <div class="bg-gray-50 rounded-lg p-4 flex items-center space-x-4">
                    <img src="${song.imageUrl}" alt="${song.name}" class="w-16 h-16 rounded-lg">
                    <div class="flex-1">
                        <h3 class="font-semibold">${song.name}</h3>
                        <p class="text-gray-600 text-sm">${song.artist}</p>
                        <p class="text-gray-500 text-xs">Added ${new Date(song.addedAt).toLocaleDateString()}</p>
                    </div>
                    <div class="flex flex-col space-y-2">
                        <button onclick="playSong('${song.songId}')" class="text-black hover:text-gray-700">
                            <i class="fas fa-play"></i>
                        </button>
                        <button onclick="removeFavorite('${song.songId}')" class="text-red-500 hover:text-red-700">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            `).join('') || '<p class="text-gray-500">No favorites yet</p>';
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}

// Load and display recently played
async function loadRecentlyPlayed() {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const recentlyPlayed = data.data.recentlyPlayed;
            const recentlyPlayedList = document.getElementById('recentlyPlayedList');
            
            recentlyPlayedList.innerHTML = recentlyPlayed.map(song => `
                <div class="bg-gray-50 rounded-lg p-4 flex items-center space-x-4">
                    <img src="${song.imageUrl}" alt="${song.name}" class="w-16 h-16 rounded-lg">
                    <div class="flex-1">
                        <h3 class="font-semibold">${song.name}</h3>
                        <p class="text-gray-600 text-sm">${song.artist}</p>
                        <p class="text-gray-500 text-xs">Played ${new Date(song.playedAt).toLocaleDateString()}</p>
                    </div>
                    <button onclick="playSong('${song.songId}')" class="text-black hover:text-gray-700">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            `).join('') || '<p class="text-gray-500">No recently played songs</p>';
        }
    } catch (error) {
        console.error('Error loading recently played:', error);
    }
}

// Load and display playlists
async function loadPlaylists() {
    try {
        const response = await fetchWithAuth('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
            const playlists = data.data.playlists;
            const playlistsList = document.getElementById('playlistsList');
            
            playlistsList.innerHTML = playlists.map(playlist => `
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-semibold text-lg">${playlist.name}</h3>
                            <p class="text-gray-600 text-sm">${playlist.songs.length} songs</p>
                        </div>
                        <button onclick="deletePlaylist('${playlist._id}')" class="text-red-500 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="space-y-2">
                        ${playlist.songs.slice(0, 3).map(song => `
                            <div class="flex items-center space-x-2 text-sm text-gray-600">
                                <i class="fas fa-music"></i>
                                <span>${song.name}</span>
                            </div>
                        `).join('')}
                        ${playlist.songs.length > 3 ? `
                            <div class="text-sm text-gray-500">
                                +${playlist.songs.length - 3} more songs
                            </div>
                        ` : ''}
                    </div>
                    <button 
                        onclick="playPlaylist('${playlist._id}')"
                        class="mt-4 w-full bg-black text-white px-4 py-2 rounded-full hover:bg-gray-800 transition-colors"
                    >
                        Play
                    </button>
                </div>
            `).join('') || '<p class="text-gray-500">No playlists yet</p>';
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

// Remove a song from favorites
async function removeFavorite(songId) {
    try {
        const response = await fetchWithAuth(`/api/user/favorites/${songId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            loadFavorites();
            loadProfile(); // Update stats
        }
    } catch (error) {
        console.error('Error removing favorite:', error);
    }
}

// Play a song
function playSong(songId) {
    window.location.href = `/?play=${songId}`;
}

// Authentication helper function
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
    }
}

// Fetch with authentication helper
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

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Initialize profile page
loadProfile();
