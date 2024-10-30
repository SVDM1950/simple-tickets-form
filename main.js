const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const fetch = require('sync-fetch');
const URLHelper = require('./helpers/url');
const ContentHelper = require('./helpers/content');
const Image = require('./helpers/image');

class SimpleTicketsForm {
    constructor(API, name, config) {
        this.API = API;
        this.name = name;
        this.config = config;
    }

    addModifiers() {
        this.API.addModifier('menuStructure', this.modifyMenuStructure, 2, this);
        this.API.addModifier('htmlOutput', this.generateTicketsForm, 2, this);
    }

    modifyMenuStructure(rendererInstance, output) {
        this.rendererInstance = rendererInstance;

        const translations = this.rendererInstance.translations.user.tickets ?? this.rendererInstance.translations.theme.tickets;

        let menu = this.config['menu'].split('/').map(menuItem => menuItem.trim());
        const mainMenu = menu.shift();

        const menuItem = {
            "id": 1,
            "label": translations.menu.label,
            "title": translations.menu.title,
            "type": "page",
            "target": "_self",
            "rel": "",
            "link": [menu.join('/'), translations.menu.slug].join('/'),
            "cssClass": "",
            "isHidden": false,
            "items": [],
            "level": 2,
            "linkID": "empty"
        }

        let menuOutput = output[mainMenu].items;

        while (menu.length > 0) {
            let menuItemName = menu.shift();

            for (let i = 0; i < menuOutput.length; i++) {
                if (menuOutput[i].link === menuItemName) {
                    menuOutput = menuOutput[i].items;
                    break;
                }
            }
        }

        let menuPosition = parseInt(this.config['menuPosition']);

        if(menuOutput.length === 0) {
            menuPosition = -1;
        } else if(menuPosition < 0) {
            menuPosition = menuOutput.length + menuPosition;
        } else if(menuPosition > 0) {
            menuPosition -= 1;
        }

        if(menuPosition === -1) {
            menuOutput.push(menuItem);
        } else {
            menuOutput.splice(menuPosition, 0, menuItem);
        }

        return output;
    }

    generateTicketsForm(rendererInstance, output, globalContext, context) {
        this.rendererInstance = rendererInstance;

        if (rendererInstance.menuContext.length !== 1 || rendererInstance.menuContext[0] !== 'frontpage') {
            return output;
        }

        const translations = this.rendererInstance.translations.user.tickets ?? this.rendererInstance.translations.theme.tickets;

        let menu = this.config['menu'].split('/').map(menuItem => menuItem.trim());
        menu.shift();

        // Load template
        let suffix = '.html';
        let pageSlug = [menu.join('/'), translations.menu.slug].join('/');
        let inputFile = 'tickets.hbs';
        let compiledTemplate = this.rendererInstance.compileTemplate(inputFile);

        if (globalContext.config.site.urls.cleanUrls) {
            suffix = '/index.html';
        }

        const oldMenuContext = this.rendererInstance.menuContext
        this.rendererInstance.menuContext = ['tickets'];

        globalContext.context = ['tickets'];
        globalContext.plugins[this.name].config.recaptcha = this.config.recaptchaEnabled && this.config.recaptchaSiteKey && !this.rendererInstance.previewMode;

        context.title = `${globalContext.website.name} - ${translations.menu.label}`;
        context.tickets = {
            title: `${translations.menu.label}`,
            featuredImage: false,
            text: globalContext.plugins[this.name].config.ticketsContent,
            events: fetch(this.config.script_events).json(),
            tickets: fetch(this.config.script_tickets).json()
        }

        if (globalContext.plugins[this.name].config['ticketsFeaturedImage'] !== undefined && globalContext.plugins[this.name].config.ticketsFeaturedImage !== '') {
            let imageUrl = globalContext.plugins[this.name].config.ticketsFeaturedImage;
            let imageData = {
                id: path.parse(imageUrl).base,
                url: imageUrl,
                alt: `${translations.menu.label}`,
            };

            context.tickets.featuredImage = this.getFeaturedImages(imageUrl, imageData);
        }

        let content = this.rendererInstance.renderTemplate(compiledTemplate, context, globalContext, inputFile);
        this.saveOutputFile(pageSlug + suffix, content);

        this.rendererInstance.menuContext = oldMenuContext

        return output;
    }

    saveOutputFile(fileName, content) {
        let filePath = path.join(this.rendererInstance.outputDir, fileName);

        fs.ensureDirSync(path.parse(filePath).dir);
        fs.outputFileSync(filePath, content, 'utf-8');
    }

    getFeaturedImages(imageFilename, featuredImageData) {
        let ticketsImage = {
            id: path.parse(imageFilename).base,
            url: imageFilename,
            additional_data: JSON.stringify(featuredImageData)
        };

        if (ticketsImage && ticketsImage.url) {
            let imagePath = '';
            let url = '';
            let alt = '';
            let caption = '';
            let credits = '';
            let imageDimensions = false;

            if (ticketsImage.additional_data) {
                let data = JSON.parse(ticketsImage.additional_data);

                imagePath = URLHelper.createImageURL(this.rendererInstance.inputDir, this.name, ticketsImage.url, 'plugin');
                let domain = this.rendererInstance.siteConfig.domain;

                url = URLHelper.createImageURL(domain, this.name, ticketsImage.url, 'plugin');
                alt = data.alt;
                caption = data.caption;
                credits = data.credits;

                try {
                    imageDimensions = sizeOf(imagePath);
                } catch(e) {
                    console.log('simple-tickets-form.js: wrong image path - missing dimensions');
                    imageDimensions = false;
                }
            } else {
                return false;
            }

            let featuredImageSrcSet = false;
            let featuredImageSizes = false;

            if(!this.isGifOrSvg(url)) {
                let useWebp = false;

                if (this.rendererInstance.siteConfig?.advanced?.forceWebp) {
                    useWebp = true;
                }

                featuredImageSrcSet = ContentHelper.getFeaturedImageSrcset(url, this.rendererInstance.themeConfig, useWebp);
                featuredImageSizes = ContentHelper.getFeaturedImageSizes(this.rendererInstance.themeConfig);
            } else {
                featuredImageSrcSet = '';
                featuredImageSizes = '';
            }

            let featuredImageData = {
                id: ticketsImage.id,
                url: url,
                alt: alt,
                caption: caption,
                credits: credits,
                height: imageDimensions.height,
                width: imageDimensions.width,
                srcset: featuredImageSrcSet,
                sizes: featuredImageSizes
            };

            // Create responsive images
            let featuredImage = new Image(this.rendererInstance, this, featuredImageData);
            const proms = featuredImage.createResponsiveImages(imagePath);
            if (proms) {
                Promise.allSettled(proms)
                .catch(() => {
                });
            }

            // Create alternative names for dimensions
            let dimensions = false;

            if (
                this.rendererInstance.themeConfig.files &&
                this.rendererInstance.themeConfig.files.responsiveImages
            ) {
                if (
                    this.rendererInstance.themeConfig.files.responsiveImages.featuredImages &&
                    this.rendererInstance.themeConfig.files.responsiveImages.featuredImages.dimensions
                ) {
                    dimensions = this.rendererInstance.themeConfig.files.responsiveImages.featuredImages.dimensions;
                } else if (
                    this.rendererInstance.themeConfig.files.responsiveImages.contentImages &&
                    this.rendererInstance.themeConfig.files.responsiveImages.contentImages.dimensions
                ) {
                    dimensions = this.rendererInstance.themeConfig.files.responsiveImages.featuredImages.dimensions;
                }

                if (dimensions) {
                    let dimensionNames = Object.keys(dimensions);

                    for (let dimensionName of dimensionNames) {
                        let base = path.parse(url).base;
                        let filename = path.parse(url).name;
                        let extension = path.parse(url).ext;
                        let newFilename = filename + '-' + dimensionName + extension;
                        let capitalizedDimensionName = dimensionName.charAt(0).toUpperCase() + dimensionName.slice(1);

                        if(!this.isGifOrSvg(url)) {
                            featuredImageData['url' + capitalizedDimensionName] = url.replace(base, newFilename);
                        } else {
                            featuredImageData['url' + capitalizedDimensionName] = url;
                        }
                    }
                }
            }

            return featuredImageData;
        }

        return false;
    }

    /**
     * Detects if image is a GIF or SVG
     */
    isGifOrSvg(url) {
        return url.slice(-4) === '.gif' || url.slice(-4) === '.svg';
    }
}

module.exports = SimpleTicketsForm;
