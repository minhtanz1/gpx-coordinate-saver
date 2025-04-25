// Global variables
let points = [];
const storageKey = 'gpxPoints';
const customNameStorageKey = 'customPointName'; // New key for custom name
const darkModeStorageKey = 'darkMode'; // New key for dark mode preference
let selectedPointType = '40km/h'; // New variable to track selected point type

// Select DOM elements
const inputMethodSelect = document.getElementById('inputMethod');
const manualInputSection = document.getElementById('manualInputSection');
const gpsInputSection = document.getElementById('gpsInputSection');

const coordinatesInput = document.getElementById('coordinates');
const addManualPointButton = document.getElementById('addManualPoint');
const coordErrorElement = document.getElementById('coord-error');

const getGpsPointButton = document.getElementById('getGpsPoint');
const gpsStatusElement = document.getElementById('gps-status');

// Updated point type selection elements
const pointTypeSelectionDiv = document.getElementById('pointTypeSelection');
const pointTypeIcons = pointTypeSelectionDiv.querySelectorAll('.point-type-icon'); // Get all icon buttons

const customNameContainer = document.getElementById('customNameContainer');
const customNameInput = document.getElementById('customName');

const exportGPXButton = document.getElementById('exportGPX');
const clearAllButton = document.getElementById('clearAll');
const pointListElement = document.getElementById('pointList');

const importGPXButton = document.getElementById('importGPXBtn');
const gpxFileInput = document.getElementById('gpxFileInput');
const fileInfoContainer = document.getElementById('fileInfoContainer');
const fileInfoElement = document.getElementById('fileInfo');

// Dark Mode Elements
const darkModeToggle = document.getElementById('darkModeToggle');
const bodyElement = document.body;


// --- Dark Mode Functions ---
function enableDarkMode() {
    bodyElement.classList.add('dark-mode');
    localStorage.setItem(darkModeStorageKey, 'enabled');
    darkModeToggle.textContent = 'Chế độ sáng';
}

function disableDarkMode() {
    bodyElement.classList.remove('dark-mode');
    localStorage.setItem(darkModeStorageKey, 'disabled');
     darkModeToggle.textContent = 'Chế độ tối';
}

function toggleDarkMode() {
    if (bodyElement.classList.contains('dark-mode')) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

function loadDarkModePreference() {
    const preference = localStorage.getItem(darkModeStorageKey);
    if (preference === 'enabled') {
        enableDarkMode();
    } else {
        disableDarkMode(); // Default to light mode
    }
}


// --- Utility Functions ---

// Function to parse coordinates from string
function parseCoordinates(input) {
    input = input.trim();
    const patterns = [
        /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/, // lat,lon or lat, lon
        /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/, // lat lon
        /^(\d+)°(\d+)'(\d+\.?\d*)"([NS])\s+(\d+)°(\d+)'(\d+\.?\d*)"([EW])$/, // DD°MM'SS.S"Dir DD°MM'SS.S"Dir
        /=(-?\d+\.?\d*),(-?\d+\.?\d*)/, // =lat,lon (simple param)
        /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/, // ll=lat,lon (Google Maps style)
        /lat=(-?\d+\.?\d*).*&(?:lon|lng)=(-?\d+\.?\d*)/i // lat=...&lon=... or lat=...&lng=... (URL params)
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
            if (pattern.toString().includes('°')) { // Handle DMS format
                const latDeg = parseFloat(match[1]);
                const latMin = parseFloat(match[2]);
                const latSec = parseFloat(match[3]);
                const latDir = match[4];

                const lonDeg = parseFloat(match[5]);
                const lonMin = parseFloat(match[6]);
                const lonSec = parseFloat(match[7]);
                const lonDir = match[8];

                let lat = latDeg + (latMin / 60) + (latSec / 3600);
                let lon = lonDeg + (lonMin / 60) + (lonSec / 3600);

                if (latDir === 'S') lat = -lat;
                if (lonDir === 'W') lon = -lon;

                if (isValidCoordinate(lat, lon)) return { lat, lon };

            } else { // Handle Decimal Degrees formats
                const lat = parseFloat(match[1]);
                const lon = parseFloat(match[2]);
                if (isValidCoordinate(lat, lon)) return { lat, lon };
            }
        }
    }
    return null;
}

// Validate coordinates
function isValidCoordinate(lat, lon) {
    return !isNaN(lat) && !isNaN(lon) &&
           lat >= -90 && lat <= 90 &&
           lon >= -180 && lon <= 180;
}

// Get point name from user selection or custom input
function getPointName() {
    if (selectedPointType === 'custom') {
        return customNameInput.value.trim() || 'Điểm tùy chỉnh';
    }
    return selectedPointType;
}

// Add a point object to the array, save, and render
function addPointObject(point) {
    points.push(point);
    savePoints();
    renderPointList();

    // If custom name was used, save it for future use
    if (selectedPointType === 'custom') {
        saveCustomName(customNameInput.value.trim());
    }
}

// Handle manual point addition
function addManualPoint() {
    const coordInput = coordinatesInput.value.trim();
    if (!coordInput) {
        showError('Vui lòng nhập tọa độ.');
        return;
    }

    const parsedCoord = parseCoordinates(coordInput);
    if (!parsedCoord) {
        showError('Không thể nhận dạng tọa độ. Vui lòng kiểm tra lại định dạng.');
        return;
    }

    clearError();

    const point = {
        name: getPointName(), // Use updated getPointName
        lat: parsedCoord.lat,
        lon: parsedCoord.lon,
        time: new Date().toISOString()
    };

    addPointObject(point);

    coordinatesInput.value = '';
    if (selectedPointType === 'custom') {
         // Don't clear customNameInput here, it's saved and reused
         // customNameInput.value = '';
    }
     coordinatesInput.focus();
}

// Handle GPS point acquisition
function getGpsPoint() {
    clearStatus();
    gpsStatusElement.className = 'message info';
    gpsStatusElement.textContent = 'Đang lấy vị trí...';
    getGpsPointButton.disabled = true;

    if (!navigator.geolocation) {
        showStatus('Thiết bị không hỗ trợ GPS.', 'error');
        getGpsPointButton.disabled = false;
        return;
    }

    navigator.permissions && navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
        if (permissionStatus.state === 'denied') {
            showStatus('Quyền truy cập vị trí bị từ chối. Vui lòng thay đổi cài đặt trình duyệt/thiết bị.', 'error');
            getGpsPointButton.disabled = false;
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 8000, // Reduced timeout
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => { // Success callback
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                const point = {
                    name: getPointName(), // Use updated getPointName
                    lat: lat,
                    lon: lon,
                    time: new Date().toISOString()
                };

                addPointObject(point);
                showStatus(`Đã thêm điểm từ GPS: Lat ${lat.toFixed(6)}, Lon ${lon.toFixed(6)}`, 'success');

                if (selectedPointType === 'custom') {
                    // Don't clear customNameInput here
                    // customNameInput.value = '';
                }
                getGpsPointButton.disabled = false;
            },
            (error) => { // Error callback
                let errorMessage = 'Không thể lấy vị trí.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Bạn đã từ chối cấp quyền vị trí. Vui lòng thay đổi cài đặt trình duyệt/thiết bị.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Thông tin vị trí không khả dụng (GPS yếu hoặc tắt).';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Hết thời gian chờ lấy vị trí. Đảm bảo bạn ở ngoài trời và bật GPS.';
                        break;
                    default:
                        errorMessage = `Lỗi không xác định khi lấy vị trí: ${error.message}`;
                }
                showStatus(errorMessage, 'error');
                getGpsPointButton.disabled = false;
            },
            options
        );
    });
}

// Display status message (for GPS)
function showStatus(message, type = 'info') {
    gpsStatusElement.textContent = message;
    gpsStatusElement.className = `message ${type}`;
}

// Clear status message (for GPS)
 function clearStatus() {
    gpsStatusElement.textContent = '';
    gpsStatusElement.className = 'message';
 }

// Display error message (for manual input)
function showError(message) {
    coordErrorElement.textContent = message;
    coordErrorElement.className = 'message error';
}

// Clear error message (for manual input)
function clearError() {
    coordErrorElement.textContent = '';
     coordErrorElement.className = 'message';
}

// Render the list of points
function renderPointList() {
    pointListElement.innerHTML = '';

    if (points.length === 0) {
        pointListElement.innerHTML = '<div class="no-points">Chưa có điểm nào được thêm</div>';
        return;
    }

    // <-- CHỖ CẦN SỬA: Thay đổi vòng lặp để đi ngược từ cuối mảng lên
    // points.forEach((point, index) => { ... }); // Dòng cũ
    for (let i = points.length - 1; i >= 0; i--) { // <-- Vòng lặp mới
        const point = points[i];
        const index = i; // <-- Lấy index hiện tại trong vòng lặp

        const timestamp = point.time ? new Date(point.time).toLocaleString() : 'Không rõ thời gian';

        const pointElement = document.createElement('div');
        pointElement.className = 'point-item';
        pointElement.innerHTML = `
            <div>
                <strong>${escapeXml(point.name)}</strong> -
                Lat: ${point.lat.toFixed(6)}, Lon: ${point.lon.toFixed(6)}
                <br><small>Thời gian: ${timestamp}</small>
            </div>
            <button class="delete-btn" data-index="${index}">Xóa</button>
        `;
        // Vẫn thêm vào cuối (appendChild), vì ta đã lặp ngược mảng
        pointListElement.appendChild(pointElement);
    }

    // Thêm sự kiện cho nút xóa (phần này giữ nguyên)
    pointListElement.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Lưu ý: index ở đây là index ban đầu trong mảng 'points'
            const index = parseInt(this.getAttribute('data-index'));
            deletePoint(index);
        });
    });
}

// Delete a point
function deletePoint(index) {
    if (index >= 0 && index < points.length) {
        points.splice(index, 1);
        savePoints();
        renderPointList();
    }
}

// Save points to Local Storage
function savePoints() {
    localStorage.setItem(storageKey, JSON.stringify(points));
}

// Load points from Local Storage
function loadPoints() {
    const savedPoints = localStorage.getItem(storageKey);
    if (savedPoints) {
        try {
            points = JSON.parse(savedPoints);
            // Ensure points have a valid time field and valid coordinates
            points = points.map(p => ({
                ...p,
                time: p.time && !isNaN(new Date(p.time)) ? p.time : new Date().toISOString()
            })).filter(p => isValidCoordinate(p.lat, p.lon));

            renderPointList();
        } catch (e) {
            console.error("Failed to parse saved points:", e);
            points = []; // Clear corrupted data
            savePoints(); // Save empty array
            renderPointList();
            alert("Lỗi khi tải dữ liệu đã lưu. Dữ liệu cũ có thể bị hỏng.");
        }
    }
}

// Save custom point name to Local Storage
function saveCustomName(name) {
    localStorage.setItem(customNameStorageKey, name);
}

// Load custom point name from Local Storage
function loadCustomName() {
    const savedName = localStorage.getItem(customNameStorageKey);
    if (savedName) {
        customNameInput.value = savedName;
    }
}


// Generate and download GPX file
function exportGPX() {
    if (points.length === 0) {
        alert('Chưa có điểm nào để xuất file.');
        return;
    }

    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Coordinate to GPX Converter" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
    <metadata>
        <name>Waypoints Export</name>
        <time>${new Date().toISOString()}</time>
    </metadata>`;

    points.forEach(point => {
        const pointTime = point.time || new Date().toISOString();
        gpxContent += `
    <wpt lat="${point.lat}" lon="${point.lon}">
        <time>${pointTime}</time>
        <name>${escapeXml(point.name)}</name>
    </wpt>`;
    });

    gpxContent += `
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waypoints_${new Date().toISOString().slice(0,10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Escape special characters for XML
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&';
            case '\'': return "'";
            case '"': return '"';
            default: return c;
        }
    });
}


// Clear all points
function clearAllPoints() {
    if (confirm('Bạn có chắc muốn xóa tất cả các điểm?')) {
        points = [];
        savePoints();
        renderPointList();
        fileInfoContainer.style.display = 'none';
    }
}

// Read GPX file content
function readGPXFile(file) {
    const reader = new FileReader();

    reader.onload = function(e) {
        const content = e.target.result;
        parseGPXContent(content, file.name);
    };

    reader.onerror = function() {
        alert('Lỗi đọc file: ' + reader.error);
    };

    reader.readAsText(file);
}

// Parse GPX content and add points
function parseGPXContent(content, fileName) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('File không phải là file GPX hợp lệ hoặc bị lỗi cấu trúc.');
        }

        const waypoints = xmlDoc.querySelectorAll('wpt');

        const metadata = xmlDoc.querySelector('metadata');
        const metadataName = metadata ? metadata.querySelector('name') : null;
        const metadataTime = metadata ? metadata.querySelector('time') : null;
        const gpxName = metadataName ? metadataName.textContent.trim() : 'Không có tên';
        const gpxTime = metadataTime && metadataTime.textContent.trim() ? new Date(metadataTime.textContent.trim()) : null;

        const validGpxTime = gpxTime && !isNaN(gpxTime);

        let fileInfoHTML = `
            <p><strong>File:</strong> ${escapeXml(fileName)}</p>
            <p><strong>Tên GPX:</strong> ${escapeXml(gpxName)}</p>
        `;

        if (validGpxTime) {
            fileInfoHTML += `<p><strong>Thời gian tạo:</strong> ${gpxTime.toLocaleString()}</p>`;
        } else {
             fileInfoHTML += `<p><strong>Thời gian tạo:</strong> Không có hoặc không hợp lệ</p>`;
        }
         fileInfoHTML += `<p><strong>Số điểm (wpt):</strong> ${waypoints.length}</p>`;

        fileInfoElement.innerHTML = fileInfoHTML;
        fileInfoContainer.style.display = 'block';

         if (waypoints.length === 0) {
             alert(`File GPX không có điểm nào (waypoints).`);
             return;
         }

        if (confirm(`Tìm thấy ${waypoints.length} điểm trong file GPX.\nBạn có muốn thêm vào danh sách hiện tại không?`)) {
            let addedCount = 0;
            waypoints.forEach(wpt => {
                const latAttr = wpt.getAttribute('lat');
                const lonAttr = wpt.getAttribute('lon');
                const lat = parseFloat(latAttr);
                const lon = parseFloat(lonAttr);
                const nameElement = wpt.querySelector('name');
                const timeElement = wpt.querySelector('time');

                if (isValidCoordinate(lat, lon)) {
                    const point = {
                        name: nameElement ? nameElement.textContent.trim() || 'Điểm nhập từ GPX' : 'Điểm nhập từ GPX',
                        lat: lat,
                        lon: lon,
                        time: timeElement && timeElement.textContent.trim() && !isNaN(new Date(timeElement.textContent.trim())) ? timeElement.textContent.trim() : new Date().toISOString()
                    };
                    points.push(point);
                    addedCount++;
                } else {
                    console.warn(`Bỏ qua điểm không hợp lệ từ GPX: Lat=${latAttr}, Lon=${lonAttr}`);
                }
            });

            if(addedCount > 0) {
                savePoints();
                renderPointList();
                alert(`Đã thêm thành công ${addedCount} điểm từ file GPX.`);
            } else {
                 alert("Không có điểm hợp lệ nào được tìm thấy trong file GPX để thêm.");
            }
        }
    } catch (error) {
        alert('Lỗi khi phân tích file GPX: ' + error.message);
        fileInfoContainer.style.display = 'none';
    }
}

// Switch between input methods
function switchInputMethod() {
    const selectedMethod = inputMethodSelect.value;
    clearError();
    clearStatus();

    if (selectedMethod === 'manual') {
        manualInputSection.style.display = 'block';
        gpsInputSection.style.display = 'none';
        manualInputSection.classList.add('input-manual');
        manualInputSection.classList.remove('input-gps');
        gpsInputSection.classList.add('input-gps');
        gpsInputSection.classList.remove('input-manual');
        coordinatesInput.focus();
    } else if (selectedMethod === 'gps') {
        manualInputSection.style.display = 'none';
        gpsInputSection.style.display = 'block';
        manualInputSection.classList.add('input-gps');
        manualInputSection.classList.remove('input-manual');
        gpsInputSection.classList.add('input-manual'); // Reusing class for display logic
        gpsInputSection.classList.remove('input-gps');

        // Prompt for location permission immediately if not granted
        navigator.permissions && navigator.permissions.query({name: 'geolocation'}).then(permissionStatus => {
             if (permissionStatus.state === 'prompt') {
                 showStatus('Vui lòng cho phép truy cập vị trí khi trình duyệt hỏi.', 'info');
             } else if (permissionStatus.state === 'denied') {
                 showStatus('Quyền truy cập vị trí bị từ chối. Vui lòng thay đổi cài đặt trình duyệt/thiết bị.', 'error');
             } else {
                  clearStatus(); // Clear initial prompt/denied status if granted or already granted
             }
        });
    }
}

// Handle point type icon selection
function selectPointType(type) {
    selectedPointType = type;

    // Update UI - set 'selected' class on the clicked button
    pointTypeIcons.forEach(iconButton => {
        iconButton.classList.remove('selected');
        if (iconButton.getAttribute('data-type') === type) {
            iconButton.classList.add('selected');
        }
    });

    // Show/hide custom name input
    if (selectedPointType === 'custom') {
        customNameContainer.style.display = 'block';
        customNameInput.focus();
        loadCustomName(); // Load saved custom name
    } else {
        customNameContainer.style.display = 'none';
    }
}


// --- Event Listeners ---
addManualPointButton.addEventListener('click', addManualPoint);
getGpsPointButton.addEventListener('click', getGpsPoint);

exportGPXButton.addEventListener('click', exportGPX);
clearAllButton.addEventListener('click', clearAllPoints);

importGPXButton.addEventListener('click', function() {
    gpxFileInput.click();
});

gpxFileInput.addEventListener('change', function(e) {
    if (this.files && this.files.length > 0) {
        const file = this.files[0];
        if (file.name.toLowerCase().endsWith('.gpx')) {
            readGPXFile(file);
        } else {
            alert('Vui lòng chọn file GPX.');
        }
        this.value = ''; // Reset input
    }
});

inputMethodSelect.addEventListener('change', switchInputMethod);

coordinatesInput.addEventListener('keypress', function(e) {
    if (inputMethodSelect.value === 'manual' && e.key === 'Enter') {
        addManualPoint();
    }
});

// Add event listeners for the new point type icon buttons
pointTypeIcons.forEach(iconButton => {
    iconButton.addEventListener('click', () => {
        const type = iconButton.getAttribute('data-type');
        selectPointType(type);
    });
});

// Dark Mode Toggle Listener
darkModeToggle.addEventListener('click', toggleDarkMode);


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    loadPoints(); // Load saved points
    loadCustomName(); // Load saved custom name
    loadDarkModePreference(); // Load dark mode preference

    // Set initial selected point type based on default or loaded state (defaults to 40km/h)
    // The initial 'selected' class in HTML ensures 40km/h is the default
    // If you wanted to load the last used type, you'd need to save/load that too.
    selectPointType(selectedPointType); // Initialize the UI based on the default/initial selected type

    switchInputMethod(); // Set up initial UI based on default selected method
});
