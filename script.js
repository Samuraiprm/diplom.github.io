document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const selectFileBtn = document.getElementById('selectFile');
    const metadataContainer = document.getElementById('metadataContainer');
    const metadataList = document.getElementById('metadataList');
    const fileNameSpan = document.getElementById('fileName');
    const downloadOriginalBtn = document.getElementById('downloadOriginal');
    const downloadModifiedBtn = document.getElementById('downloadModified');
    const clearMetadataBtn = document.getElementById('clearMetadata');

    let currentFile = null;
    let modifiedFile = null;

    // Обработка Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', handleDrop);
    selectFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        if (file.size > 4 * 1024 * 1024 * 1024) { // 4GB
            showError('Файл слишком большой. Максимальный размер: 4 ГБ');
            return;
        }

        currentFile = file;
        fileNameSpan.textContent = file.name;
        metadataContainer.style.display = 'block';
        loadMetadata(file);
    }

    function loadMetadata(file) {
        metadataList.innerHTML = '';
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                // Базовые метаданные
                const basicMetadata = {
                    'Имя файла': file.name,
                    'Тип файла': file.type || 'Неизвестно',
                    'Размер': formatFileSize(file.size),
                    'Последнее изменение': new Date(file.lastModified).toLocaleString()
                };

                // Отображение базовых метаданных
                Object.entries(basicMetadata).forEach(([key, value]) => {
                    addMetadataItem(key, value);
                });

                // Если это изображение, извлекаем расширенные метаданные
                if (file.type.startsWith('image/')) {
                    EXIF.getData(file, function() {
                        const exifData = EXIF.getAllTags(this);
                        if (exifData) {
                            // Геопозиция
                            if (exifData.GPSLatitude && exifData.GPSLongitude) {
                                const lat = convertDMSToDD(exifData.GPSLatitude, exifData.GPSLatitudeRef);
                                const lng = convertDMSToDD(exifData.GPSLongitude, exifData.GPSLongitudeRef);
                                addMetadataItem('Геопозиция', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                                addMapLink(lat, lng);
                            }

                            // Информация о камере
                            if (exifData.Make || exifData.Model) {
                                addMetadataItem('Камера', `${exifData.Make || ''} ${exifData.Model || ''}`.trim());
                            }
                            if (exifData.LensMake || exifData.LensModel) {
                                addMetadataItem('Объектив', `${exifData.LensMake || ''} ${exifData.LensModel || ''}`.trim());
                            }

                            // Параметры съёмки
                            if (exifData.ExposureTime) {
                                addMetadataItem('Выдержка', `1/${Math.round(1/exifData.ExposureTime)} сек`);
                            }
                            if (exifData.FNumber) {
                                addMetadataItem('Диафрагма', `f/${exifData.FNumber}`);
                            }
                            if (exifData.ISO) {
                                addMetadataItem('ISO', exifData.ISO);
                            }

                            // Дата создания
                            if (exifData.DateTimeOriginal) {
                                addMetadataItem('Дата создания', new Date(exifData.DateTimeOriginal).toLocaleString());
                            }

                            // Автор и копирайт
                            if (exifData.Artist) {
                                addMetadataItem('Автор', exifData.Artist);
                            }
                            if (exifData.Copyright) {
                                addMetadataItem('Авторские права', exifData.Copyright);
                            }

                            // Размеры изображения
                            if (exifData.PixelXDimension && exifData.PixelYDimension) {
                                addMetadataItem('Размеры', `${exifData.PixelXDimension} × ${exifData.PixelYDimension} пикселей`);
                            }
                        }
                    });
                }

                // Для PDF файлов
                if (file.type === 'application/pdf') {
                    addMetadataItem('Тип документа', 'PDF');
                    // Здесь можно добавить извлечение метаданных PDF
                }

                // Для аудио файлов
                if (file.type.startsWith('audio/')) {
                    const audio = new Audio();
                    audio.src = URL.createObjectURL(file);
                    audio.addEventListener('loadedmetadata', () => {
                        addMetadataItem('Длительность', formatDuration(audio.duration));
                        URL.revokeObjectURL(audio.src);
                    });
                }

                // Для видео файлов
                if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = URL.createObjectURL(file);
                    video.addEventListener('loadedmetadata', () => {
                        addMetadataItem('Длительность', formatDuration(video.duration));
                        addMetadataItem('Разрешение', `${video.videoWidth} × ${video.videoHeight}`);
                        URL.revokeObjectURL(video.src);
                    });
                }

            } catch (error) {
                showError('Ошибка при чтении метаданных');
                console.error(error);
            }
        };

        reader.onerror = function() {
            showError('Ошибка при чтении файла');
        };

        reader.readAsArrayBuffer(file);
    }

    function addMetadataItem(key, value) {
        const item = document.createElement('div');
        item.className = 'metadata-item';
        
        const keyElement = document.createElement('span');
        keyElement.textContent = key;
        
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.value = value;
        valueInput.addEventListener('change', () => {
            // Здесь можно добавить логику изменения метаданных
            modifiedFile = currentFile; // В реальном приложении здесь будет actual modification
        });
        
        item.appendChild(keyElement);
        item.appendChild(valueInput);
        metadataList.appendChild(item);
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Байт';
        const k = 1024;
        const sizes = ['Байт', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.color = 'var(--error-color)';
        errorDiv.style.padding = '1rem';
        errorDiv.style.marginTop = '1rem';
        errorDiv.style.background = 'rgba(255, 59, 48, 0.1)';
        errorDiv.style.borderRadius = '0.5rem';
        
        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, metadataContainer);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Обработчики кнопок
    downloadOriginalBtn.addEventListener('click', () => {
        if (currentFile) {
            downloadFile(currentFile);
        }
    });

    downloadModifiedBtn.addEventListener('click', () => {
        if (modifiedFile) {
            downloadFile(modifiedFile);
        } else {
            showError('Нет изменённого файла');
        }
    });

    clearMetadataBtn.addEventListener('click', () => {
        if (currentFile) {
            // В реальном приложении здесь будет actual metadata clearing
            showError('Функция очистки метаданных в разработке');
        }
    });

    function downloadFile(file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Вспомогательные функции
    function convertDMSToDD(dms, ref) {
        const degrees = dms[0];
        const minutes = dms[1];
        const seconds = dms[2];
        let dd = degrees + minutes/60 + seconds/3600;
        if (ref === 'S' || ref === 'W') {
            dd = dd * -1;
        }
        return dd;
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    function addMapLink(lat, lng) {
        const mapLink = document.createElement('a');
        mapLink.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`;
        mapLink.target = '_blank';
        mapLink.className = 'action-button';
        mapLink.textContent = 'Открыть на карте';
        
        const actions = document.querySelector('.actions');
        actions.appendChild(mapLink);
    }
}); 