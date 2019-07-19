const miflora = require('miflora')
var Service, Characteristic


module.exports = function (homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic

    homebridge.registerAccessory("homebridge-xiaomi-plant-monitor", "xiaomi-plant-monitor", MifloraAccessory)
}


function MifloraAccessory(log, config) {
    this.log = log
    this.name = config['name'] || 'Mi Plant'
    if (!config['macAddress']) {
        this.log('No mac address define for', this.name)
        return
    }

    this.macAddress = config['macAddress'].toLocaleLowerCase()
    this.scanDurationInMs = config['scanDurationInMs'] || 60000
    this.fetchDataIntervalInMs = config['fetchDataIntervalInMs'] || 3600000

    this.humidityService = new Service.HumiditySensor(this.name)
    this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).on('get', callback => callback(null, 0))
    this.humidityService.getCharacteristic(Characteristic.StatusLowBattery).on('get', callback => callback(null, false))
    this.humidityService.getCharacteristic(Characteristic.StatusActive).on('get', callback => callback(null, false))

    try {
        init(this.macAddress, this.scanDurationInMs, this.fetchDataIntervalInMs, this.humidityService, this.log)
    } catch (e) {
        this.log(e)
    }
}

async function init(macAddress, scanDurationInMs, fetchDataIntervalInMs, humidityService, log) {
    log('Scanning %s for a max of %s seconds', macAddress, scanDurationInMs / 1000)
    log('Fetch data every %s seconds', fetchDataIntervalInMs / 1000)
    const devices = await miflora.discover({
        addresses: [macAddress],
        ignoreUnknown: true,
        duration: scanDurationInMs
    })
    const device = devices.find(entry => entry.address === macAddress)
    if (device) {
        await getPlantData(device, humidityService, log)
        setInterval(() => getPlantData(device, humidityService, log), fetchDataIntervalInMs)
    } else {
        log('Device %s not found', macAddress)
    }
}

async function getPlantData(device, humidityService, log) {
    try {
        const {firmwareInfo: {battery, firmware}, sensorValues: {temperature, lux, moisture, fertility}} = await device.query()
        log(`battery: ${battery}%  firmware: ${firmware} temperature: ${temperature}° lux: ${lux} moisture: ${moisture}% fertility: ${fertility}`)

        humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(moisture)
        humidityService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(battery < 10)
        humidityService.getCharacteristic(Characteristic.StatusActive).updateValue(true)
    } catch (e) {
        log(e)
    }
}

MifloraAccessory.prototype.getServices = function () {
    return [this.humidityService]
}