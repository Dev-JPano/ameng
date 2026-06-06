Ameng Portfolio — Final Motion Hero Patch

Files:
- index.html
- style.css
- script.js
- data.json

Hero updates:
- Removed the word “Waiting”.
- Main photo now changes with a flying-copy animation from the waiting row into the main area.
- The previous main image tears/burns away during the transition.
- The next 10-second cycle starts only after the new image is loaded, in place, glowing, and the receiving animation has settled.
- Name hover is now per letter, not per word.
- Main image has stronger glowing border.
- Main image tilts smoothly toward the cursor on desktop.
- Waiting thumbnails still expand only the exact hovered image; the rest are pushed and blurred.
- Modal close button remains on top of the image on mobile.

Profile image warning:
- Recommended profile count: 4 to 12.
- Too many profile images may still fit in one row, but thumbnails can become too narrow.

How to run:
Use Live Server or:
python -m http.server 5500

Then open:
http://localhost:5500


Bug fix:
- Fixed TypeError: Cannot set properties of null (setting 'textContent').
- Cause: the WAITING header/counter was removed from HTML, but script.js still tried to update #waitingCount.
- Fix: #waitingCount is now optional.


Favicon + social sharing update:
- The browser tab icon now uses gallery.logo from data.json.
- Added Open Graph and Twitter meta tags.
- On browser load, script.js picks a random image from gallery.profile and updates og:image / twitter:image.
- HTML also includes a fallback share image: https://res.cloudinary.com/dliri1ig9/image/upload/v1780729756/profile/2_jdjvdn.png

Important limitation for static hosting:
- Many social platforms (Facebook, Messenger, Discord, X, etc.) cache the preview and often do not execute JavaScript.
- Because this site is static (ex. GitHub Pages), true per-share random preview images are not guaranteed.
- In practice, the fallback image in the HTML is the most reliable image for link sharing.
- If you want truly random previews for each share request, you would need server-side logic or a build step that rewrites the meta tags.


Loading screen + cache update:
- Added a full-screen custom loading screen with a real progress bar.
- Progress is based on actual image assets collected from data.json.
- The site opens only after gallery/profile/achievement images are loaded or cached.
- Added Cache API warm-up for images.
- Added sw.js service worker for cache-first revisits on HTTPS/localhost.
- Browser caching/service-worker caching means repeat visits should load much faster.
- Note: service workers require HTTPS, so caching becomes active after GitHub Pages HTTPS works.
