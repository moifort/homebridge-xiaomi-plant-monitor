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

    this.batteryService = new Service.BatteryService(this.name)
    this.batteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', callback => callback(null, 0))
    this.batteryService.getCharacteristic(Characteristic.ChargingState).on('get', callback => callback(null, false))
    this.batteryService.getCharacteristic(Characteristic.StatusLowBattery).on('get', callback => callback(null, false))

    try {
        init(this.macAddress, this.scanDurationInMs, this.fetchDataIntervalInMs, this.humidityService, this.batteryService, this.log)
    } catch (e) {
        this.log(e)
    }
}

async function init(macAddress, scanDurationInMs, fetchDataIntervalInMs, humidityService, batteryService, log) {
    log('Scanning %s for a max of %s seconds', macAddress, scanDurationInMs / 1000)
    log('Fetch data every %s seconds', fetchDataIntervalInMs / 1000)
    const devices = await miflora.discover({
        addresses: [macAddress],
        ignoreUnknown: true,
        duration: scanDurationInMs
    })
    const device = devices.find(entry => entry.address === macAddress)
    if (device) {
        await getPlantData(device, humidityService, batteryService, log)
        setInterval(() => getPlantData(device, humidityService, batteryService, log), fetchDataIntervalInMs)
    } else {
        log('Device %s not found', macAddress)
    }
}

async function getPlantData(device, humidityService, batteryService, log) {
    try {
        const {firmwareInfo: {battery, firmware}, sensorValues: {temperature, lux, moisture, fertility}} = await device.query()
        log(`battery: ${battery}%  firmware: ${firmware} temperature: ${temperature}° lux: ${lux} moisture: ${moisture}% fertility: ${fertility}`)

        const isLowBattery = battery < 10
        humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(moisture)
        humidityService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(isLowBattery)
        humidityService.getCharacteristic(Characteristic.StatusActive).updateValue(true)

        batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(battery)
        batteryService.getCharacteristic(Characteristic.ChargingState).updateValue(false)
        batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(isLowBattery)
    } catch (e) {
        log(e)
    }
}

MifloraAccessory.prototype.getServices = function () {
    return [this.humidityService]
}