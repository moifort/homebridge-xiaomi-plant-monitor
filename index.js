const miflora = require('miflora')
var Service, Characteristic


module.exports = function (homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic

    homebridge.registerAccessory("homebridge-xiaomi-plant-monitor", "xiaomi-plant-monitor", MifloraAccessory)
}


function MifloraAccessory(log, config) {
    this.log = log
    this.discoverOptions = {
        addresses: ['c4:7c:8d:6a:65:de'],
        ignoreUnknown: true,
        duration: 60000
    }

    this.humidityService = new Service.HumiditySensor('Ficus')
    this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', callback => callback(null, 0))
    this.humidityService.getCharacteristic(Characteristic.StatusLowBattery)
        .on('get', callback => callback(null, false))
    this.humidityService.getCharacteristic(Characteristic.StatusActive)
        .on('get', callback => callback(null, false))

    init(this.discoverOptions, this.humidityService)
}

async function init(discoverOptions, humidityService) {
    console.log('> scanning for a max of %s seconds', discoverOptions.duration / 1000)
    const devices = await miflora.discover(discoverOptions)
    const device = devices.find(entry => entry.address === 'c4:7c:8d:6a:65:de')
    if (device) {
        await getPlantData(device, humidityService)
        setInterval(() => getPlantData(device, humidityService), 60000)
    } else {
        console.log('not found')
    }
}

async function getPlantData(device, humidityService) {
    try {
        const {firmwareInfo: {battery, firmware}, sensorValues: {temperature, lux, moisture, fertility}} = await device.query()
        console.log(battery, firmware, temperature, lux, moisture, fertility)
        humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .updateValue(moisture)
        humidityService.getCharacteristic(Characteristic.StatusLowBattery)
            .updateValue(battery < 10)
        humidityService.getCharacteristic(Characteristic.StatusActive)
            .updateValue(true)
    } catch (e) {
        console.log(e)
    }
}

MifloraAccessory.prototype.getServices = function () {
    return [this.humidityService]
}