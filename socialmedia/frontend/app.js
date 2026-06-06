// ConnectHub - main app logic with image/video support

// media is stored as base64 in localStorage
// in a real app you'd upload to a server or cloud storage like AWS S3

function getPosts() { return JSON.parse(localStorage.getItem("sm_posts")) || []; }
function savePosts(p) { localStorage.setItem("sm_posts", JSON.stringify(p)); }
function getCurrentUser() { var u = localStorage.getItem("sm_user"); return u ? JSON.parse(u) : null; }
function logoutUser() { localStorage.removeItem("sm_user"); window.location.href = "login.html"; }
function getInitial(name) { return name ? name.charAt(0).toUpperCase() : "?"; }

function timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
    if (diff < 604800) return Math.floor(diff / 86400) + " days ago";
    return new Date(ts).toLocaleDateString();
}

// ── MEDIA HANDLING ──────────────────────────────────

var selectedMedia = []; // array of { type: "image"|"video", dataUrl: "..." }

function triggerPhotoUpload() {
    document.getElementById("photo-input").click();
}

function triggerVideoUpload() {
    document.getElementById("video-input").click();
}

function handlePhotoSelect(input) {
    var files = Array.from(input.files);
    if (selectedMedia.length + files.length > 4) {
        showToast("Max 4 images allowed");
        return;
    }
    files.forEach(function(file) {
        if (!file.type.startsWith("image/")) return;
        if (file.size > 5 * 1024 * 1024) { showToast("Image too large (max 5MB)"); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            selectedMedia.push({ type: "image", dataUrl: e.target.result });
            renderMediaPreviews();
        };
        reader.readAsDataURL(file);
    });
    input.value = ""; // reset so same file can be re-selected
}

function handleVideoSelect(input) {
    var file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) return;
    if (file.size > 30 * 1024 * 1024) { showToast("Video too large (max 30MB)"); return; }
    if (selectedMedia.filter(function(m){ return m.type === "video"; }).length > 0) {
        showToast("Only 1 video per post");
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        selectedMedia.push({ type: "video", dataUrl: e.target.result });
        renderMediaPreviews();
    };
    reader.readAsDataURL(file);
    input.value = "";
}

function removeMediaItem(index) {
    selectedMedia.splice(index, 1);
    renderMediaPreviews();
}

function renderMediaPreviews() {
    var area = document.getElementById("media-preview-area");
    var grid = document.getElementById("media-preview-grid");
    if (!area || !grid) return;

    if (selectedMedia.length === 0) {
        area.classList.remove("show");
        grid.innerHTML = "";
        return;
    }

    area.classList.add("show");
    grid.innerHTML = "";

    selectedMedia.forEach(function(item, idx) {
        var div = document.createElement("div");
        div.className = "preview-item";

        if (item.type === "image") {
            div.innerHTML = `<img src="${item.dataUrl}" alt="preview">
                <button class="remove-preview" onclick="removeMediaItem(${idx})">✕</button>`;
        } else {
            div.innerHTML = `<video src="${item.dataUrl}" controls></video>
                <button class="remove-preview" onclick="removeMediaItem(${idx})">✕</button>`;
        }
        grid.appendChild(div);
    });
}

// ── CREATE POST ──────────────────────────────────────

function createPost() {
    var user = getCurrentUser();
    if (!user) { alert("Please login first!"); return; }

    var text = document.getElementById("post-text").value.trim();

    if (!text && selectedMedia.length === 0) {
        showToast("Write something or add a photo/video!");
        return;
    }

    var btn = document.getElementById("post-btn");
    btn.disabled = true;
    btn.textContent = "Posting...";

    var posts = getPosts();
    var newPost = {
        id: Date.now(),
        authorId: user.id,
        authorName: user.name,
        content: text,
        media: selectedMedia.slice(), // copy the array
        likes: [],
        comments: [],
        time: Date.now()
    };

    posts.unshift(newPost);
    savePosts(posts);

    // reset form
    document.getElementById("post-text").value = "";
    selectedMedia = [];
    renderMediaPreviews();
    btn.disabled = false;
    btn.textContent = "Post";

    loadFeed();
    showToast("Post shared! ✓");
}

// ── RENDER MEDIA inside a post ───────────────────────

function buildMediaHTML(media) {
    if (!media || media.length === 0) return "";

    var images = media.filter(function(m) { return m.type === "image"; });
    var videos = media.filter(function(m) { return m.type === "video"; });

    var html = '<div class="post-media">';

    // video comes first if present
    if (videos.length > 0) {
        html += `<video src="${videos[0].dataUrl}" controls preload="metadata" style="width:100%;max-height:480px;border-radius:12px;display:block;"></video>`;
    }

    // images layout
    if (images.length === 1) {
        html += `<img src="${images[0].dataUrl}" alt="post image" onclick="openLightbox('${images[0].dataUrl}')" style="width:100%;max-height:520px;object-fit:cover;display:block;border-radius:${videos.length>0?'0 0 12px 12px':'12px'};cursor:pointer;">`;
    } else if (images.length === 2) {
        html += `<div class="media-grid-2">
            <img src="${images[0].dataUrl}" onclick="openLightbox('${images[0].dataUrl}')" style="width:100%;height:260px;object-fit:cover;cursor:pointer;">
            <img src="${images[1].dataUrl}" onclick="openLightbox('${images[1].dataUrl}')" style="width:100%;height:260px;object-fit:cover;cursor:pointer;">
        </div>`;
    } else if (images.length === 3) {
        html += `<div class="media-grid-2">
            <img src="${images[0].dataUrl}" onclick="openLightbox('${images[0].dataUrl}')" style="width:100%;height:300px;object-fit:cover;cursor:pointer;grid-row:span 2;">
            <img src="${images[1].dataUrl}" onclick="openLightbox('${images[1].dataUrl}')" style="width:100%;height:148px;object-fit:cover;cursor:pointer;">
            <img src="${images[2].dataUrl}" onclick="openLightbox('${images[2].dataUrl}')" style="width:100%;height:148px;object-fit:cover;cursor:pointer;">
        </div>`;
    } else if (images.length >= 4) {
        html += `<div class="media-grid-2">
            <img src="${images[0].dataUrl}" onclick="openLightbox('${images[0].dataUrl}')" style="width:100%;height:200px;object-fit:cover;cursor:pointer;">
            <img src="${images[1].dataUrl}" onclick="openLightbox('${images[1].dataUrl}')" style="width:100%;height:200px;object-fit:cover;cursor:pointer;">
            <img src="${images[2].dataUrl}" onclick="openLightbox('${images[2].dataUrl}')" style="width:100%;height:200px;object-fit:cover;cursor:pointer;">
            <img src="${images[3].dataUrl}" onclick="openLightbox('${images[3].dataUrl}')" style="width:100%;height:200px;object-fit:cover;cursor:pointer;">
        </div>`;
    }

    html += '</div>';
    return html;
}

// ── LIGHTBOX ─────────────────────────────────────────

function openLightbox(src) {
    var lb = document.getElementById("lightbox");
    var img = document.getElementById("lightbox-img");
    if (!lb || !img) return;
    img.src = src;
    lb.classList.add("open");
}

function closeLightbox() {
    var lb = document.getElementById("lightbox");
    if (lb) lb.classList.remove("open");
}

// ── LOAD FEED ─────────────────────────────────────────

function loadFeed() {
    var feed = document.getElementById("posts-feed");
    if (!feed) return;

    var posts = getPosts();
    var user = getCurrentUser();
    feed.innerHTML = "";

    if (posts.length === 0) {
        feed.innerHTML = "<div class='no-posts'><div style='font-size:48px;margin-bottom:12px;'>📭</div><p>No posts yet. Be the first to share!</p></div>";
        return;
    }

    posts.forEach(function(post) {
        var isLiked = user && post.likes.includes(user.id);
        var card = document.createElement("div");
        card.className = "post-card";

        // build comments html
        var commentsHtml = "";
        (post.comments || []).forEach(function(c, cidx) {
            var isMyComment = user && user.id === c.authorId;
            var delBtn = isMyComment
                ? `<button class="comment-del-btn" onclick="deleteComment(${post.id}, ${cidx})" title="Delete comment">✕</button>`
                : "";
            commentsHtml += `<div class="comment">
                <div class="avatar">${getInitial(c.authorName)}</div>
                <div class="comment-body">
                    <div class="commenter-name">${c.authorName}</div>
                    <div>${c.text}</div>
                </div>
                ${delBtn}
            </div>`;
        });

        var addCommentHtml = user ? `<div class="add-comment">
            <div class="avatar" style="width:32px;height:32px;font-size:13px;">${getInitial(user.name)}</div>
            <input type="text" id="ci-${post.id}" placeholder="Write a comment..." onkeydown="if(event.key==='Enter')addComment(${post.id})">
            <button onclick="addComment(${post.id})">Post</button>
        </div>` : "";

        var likeCount = (post.likes || []).length;
        var commentCount = (post.comments || []).length;

        // show 3-dot menu only to the post owner
        var isOwner = user && user.id === post.authorId;
        var menuHTML = isOwner ? `
            <div class="post-menu-wrapper">
                <button class="post-menu-btn" onclick="togglePostMenu(${post.id})">⋯</button>
                <div class="post-menu-dropdown" id="menu-${post.id}">
                    <button onclick="deletePost(${post.id})">🗑️ Delete Post</button>
                </div>
            </div>` : "";

        card.innerHTML = `
            <div class="post-header">
                <div class="avatar">${getInitial(post.authorName)}</div>
                <div class="post-author-info">
                    <div class="author-name" onclick="goToProfile(${post.authorId})">${post.authorName}</div>
                    <div class="post-time">${timeAgo(post.time)}</div>
                </div>
                ${menuHTML}
            </div>
            ${post.content ? `<div class="post-text">${post.content}</div>` : ""}
            ${buildMediaHTML(post.media || [])}
            <div class="post-stats">
                ${likeCount > 0 ? `<span>👍 ${likeCount} like${likeCount > 1 ? 's' : ''}</span>` : ""}
                ${commentCount > 0 ? `<span>💬 ${commentCount} comment${commentCount > 1 ? 's' : ''}</span>` : ""}
            </div>
            <div class="post-actions">
                <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
                    ${isLiked ? '👍' : '👍'} Like
                </button>
                <button class="action-btn" onclick="toggleComments(${post.id})">
                    💬 Comment
                </button>
            </div>
            <div class="comments-section" id="cs-${post.id}">
                ${commentsHtml}
                ${addCommentHtml}
            </div>`;

        feed.appendChild(card);
    });
}

// ── LIKE / COMMENT / FOLLOW ──────────────────────────

function toggleLike(postId) {
    var user = getCurrentUser();
    if (!user) { showToast("Please login to like posts"); return; }
    var posts = getPosts();
    posts.forEach(function(p) {
        if (p.id === postId) {
            var idx = p.likes.indexOf(user.id);
            if (idx > -1) p.likes.splice(idx, 1);
            else p.likes.push(user.id);
        }
    });
    savePosts(posts);
    loadFeed();
}

function toggleComments(postId) {
    var el = document.getElementById("cs-" + postId);
    if (!el) return;
    el.style.display = el.style.display === "block" ? "none" : "block";
}

function addComment(postId) {
    var user = getCurrentUser();
    if (!user) return;
    var input = document.getElementById("ci-" + postId);
    var text = input.value.trim();
    if (!text) return;
    var posts = getPosts();
    posts.forEach(function(p) {
        if (p.id === postId) {
            p.comments.push({ authorId: user.id, authorName: user.name, text: text, time: Date.now() });
        }
    });
    savePosts(posts);
    input.value = "";
    loadFeed();
    setTimeout(function() {
        var el = document.getElementById("cs-" + postId);
        if (el) el.style.display = "block";
    }, 30);
}

function goToProfile(userId) { window.location.href = "profile.html?id=" + userId; }

// show/hide the 3-dot dropdown menu
function togglePostMenu(postId) {
    document.querySelectorAll(".post-menu-dropdown").forEach(function(el) {
        if (el.id !== "menu-" + postId) el.classList.remove("open");
    });
    var menu = document.getElementById("menu-" + postId);
    if (menu) menu.classList.toggle("open");
}

// delete a post - only the post owner can do this
function deletePost(postId) {
    var user = getCurrentUser();
    if (!user) return;
    var confirmed = confirm("Delete this post? This cannot be undone.");
    if (!confirmed) return;
    var posts = getPosts();
    var newPosts = posts.filter(function(p) { return p.id !== postId; });
    savePosts(newPosts);
    showToast("Post deleted.");
    loadFeed();
}

// delete your own comment from a post
function deleteComment(postId, commentIndex) {
    var user = getCurrentUser();
    if (!user) return;
    var posts = getPosts();
    posts.forEach(function(p) {
        if (p.id === postId) {
            if (p.comments[commentIndex] && p.comments[commentIndex].authorId === user.id) {
                p.comments.splice(commentIndex, 1);
            }
        }
    });
    savePosts(posts);
    loadFeed();
    setTimeout(function() {
        var el = document.getElementById("cs-" + postId);
        if (el) el.style.display = "block";
    }, 30);
}

// ── NAVBAR ───────────────────────────────────────────

function updateNavbar() {
    var user = getCurrentUser();
    var loginNav = document.getElementById("login-nav");
    var logoutNav = document.getElementById("logout-nav");
    var profileNav = document.getElementById("profile-nav");
    var createPost = document.getElementById("create-post-box");

    if (user) {
        if (loginNav) loginNav.style.display = "none";
        if (logoutNav) logoutNav.style.display = "inline";
        if (profileNav) { profileNav.style.display = "inline"; profileNav.textContent = user.name.split(" ")[0]; }
        if (createPost) createPost.style.display = "block";
    } else {
        if (loginNav) loginNav.style.display = "inline";
        if (logoutNav) logoutNav.style.display = "none";
        if (profileNav) profileNav.style.display = "none";
    }
}

// ── TOAST ────────────────────────────────────────────

function showToast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(function() { t.style.display = "none"; }, 2500);
}

// ── SEED POSTS ───────────────────────────────────────

function seedPosts() {
    if (getPosts().length > 0) return;
    savePosts([
        { id: 2, authorId: 998, authorName: "Rahul Verma", content: "Just finished my morning run! 5km in 28 minutes. Feeling amazing 💪 Who else here is into fitness?", media: [], likes: [], comments: [{ authorId: 999, authorName: "Priya Sharma", text: "That's awesome! Keep it up 🔥", time: Date.now() - 1200000 }], time: Date.now() - 7200000 },
        { id: 1, authorId: 999, authorName: "Priya Sharma", content: "Hello ConnectHub! Excited to be here. Looking forward to connecting with everyone! 😊", media: [], likes: [], comments: [], time: Date.now() - 14400000 }
    ]);
}

// ── INIT ─────────────────────────────────────────────

window.onload = function() {
    seedPosts();
    updateNavbar();
    loadFeed();

    // close lightbox on background click
    var lb = document.getElementById("lightbox");
    if (lb) {
        lb.addEventListener("click", function(e) {
            if (e.target === lb) closeLightbox();
        });
    }
};
