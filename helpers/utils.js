/*
 * Other helper functions
 */
const fs = require('fs-extra');
const path = require('path');
const normalizePath = require('normalize-path');

class UtilsHelper {
    /*
     *  Object helper functions
     */

    /*
     * Deep merge for objects as Object.assign not merge objects properly
     */
    static mergeObjects(target, source) {
        if (typeof target !== 'object') {
            target = {};
        }

        for (let property in source) {
            if (source.hasOwnProperty(property)) {
                let sourceProperty = source[property];

                if (typeof sourceProperty === 'object' && !Array.isArray(sourceProperty) && !(sourceProperty instanceof Date)) {
                    target[property] = UtilsHelper.mergeObjects(target[property], sourceProperty);
                    continue;
                } else if(sourceProperty instanceof Date) {
                    target[property] = new Date(sourceProperty.getTime());
                    continue;
                }

                target[property] = sourceProperty;
            }
        }

        for (let a = 2, l = arguments.length; a < l; a++) {
            UtilsHelper.mergeObjects(target, arguments[a]);
        }

        return target;
    }

    /*
     *  Filesystem helper functions
     */

    /*
     * Check if the dir exists
     */
    static dirExists(dirPath) {
        let dirStat = false;

        try {
            dirStat = fs.statSync(dirPath);
        } catch(e) {}

        if(dirStat && dirStat.isDirectory()) {
            return true;
        }

        return false;
    }

    /*
     *  Responsive images helper functions
     */

    /*
     * Return true if responsive images config exists
     */
    static responsiveImagesConfigExists(themeConfig, type = false) {
        let files = themeConfig.files;

        if(type === false) {
            return !!files &&
                   !!files.responsiveImages &&
                   !!files.responsiveImages.contentImages &&
                   !!files.responsiveImages.contentImages.dimensions;
        }

        // When we want to check if configuration for a specific images exists
        return !!files &&
               !!files.responsiveImages &&
               !!files.responsiveImages[type] &&
               !!files.responsiveImages[type].dimensions;
    }

    /*
     * Return responsive image dimensions for given config
     */
    static responsiveImagesDimensions(themeConfig, type, group = false) {
        if(!UtilsHelper.responsiveImagesConfigExists(themeConfig)) {
            return false;
        }

        if(UtilsHelper.responsiveImagesConfigExists(themeConfig, type)) {
            let dimensions = false;

            if(themeConfig.files.responsiveImages[type]) {
                dimensions = themeConfig.files.responsiveImages[type].dimensions;
            } else {
                return false;
            }

            if(!group) {
                return UtilsHelper.responsiveImagesDimensionNames(dimensions);
            }

            return UtilsHelper.responsiveImagesDimensionNames(dimensions, group);
        }

        return false;
    }

    /*
     * Return responsive image dimensions data
     */
    static responsiveImagesData(themeConfig, type, group = false) {
        if(!UtilsHelper.responsiveImagesConfigExists(themeConfig)) {
            return false;
        }

        if(UtilsHelper.responsiveImagesConfigExists(themeConfig, type)) {
            let dimensions = false;

            if(themeConfig.files.responsiveImages[type]) {
                dimensions = themeConfig.files.responsiveImages[type].dimensions;
            } else {
                console.log('TYPE: ' + type + ' NOT EXISTS!');
                return false;
            }

            let filteredDimensions = false;
            let dimensionNames = Object.keys(dimensions);

            if(!group) {
                return dimensions;
            }

            for(let name of dimensionNames) {
                if(dimensions[name].group.split(',').indexOf(group) > -1) {
                    if(filteredDimensions === false) {
                        filteredDimensions = {};
                    }

                    filteredDimensions[name] = Object.assign({}, dimensions[name]);
                }
            }

            return filteredDimensions;
        }

        return false;
    }

    /*
     * Return responsive images groups
     */
    static responsiveImagesGroups(themeConfig, type) {
        if (!UtilsHelper.responsiveImagesConfigExists(themeConfig)) {
            return false;
        }

        if (UtilsHelper.responsiveImagesConfigExists(themeConfig, type)) {
            let groups = false;
            let dimensions = false;

            if(themeConfig.files.responsiveImages[type]) {
                dimensions = themeConfig.files.responsiveImages[type].dimensions;
            } else {
                return false;
            }

            let keys = Object.keys(dimensions);

            for(let key of keys) {
                if(dimensions[key].group) {
                    if(groups === false) {
                        groups = [];
                    }

                    let foundedGroups = dimensions[key].group.split(',');

                    for(let foundedGroup of foundedGroups) {
                        if (groups.indexOf(foundedGroup)) {
                            groups.push(foundedGroup);
                        }
                    }
                }
            }

            return groups;
        }

        return false;
    }

    /*
     * Return responsive image dimensions for given config
     */
    static responsiveImagesDimensionNames(dimensions, group = false) {
        // Get object keys for group type check
        let keys = Object.keys(dimensions);
        let dimensionNames = false;

        // When we have groups and the group param is set - filter results to a specific group
        if(group !== false) {
            for(let key of keys) {
                if(dimensions[key].group.split(',').indexOf(group) > -1) {
                    if(dimensionNames === false) {
                        dimensionNames = [];
                    }

                    dimensionNames.push(key);
                }
            }
        } else {
            // When there is no groups
            dimensionNames = Object.keys(dimensions);
        }

        return dimensionNames;
    }
}

module.exports = UtilsHelper;
