const miflora = require('miflora')
let Accessory, Service, Characteristic, UUIDGen

module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    UUIDGen = homebridge.hap.uuid

    homebridge.registerPlatform('homebridge-xiaomi-plant-monitor', 'xiaomi-plant-monitor', MifloraPlatfrom, true)
}

class MifloraPlatfrom {

    constructor(log, config, api) {
        this.log = log
        this.api = api
        this.fetchDataIntervalInMs = config['fetchDataIntervalInMs'] || 3600000 // Every hours
        this.plants = []

        this.run().catch(error => this.log.error(error))
        setInterval(() => this.run().catch(error => this.log.error(error)), this.fetchDataIntervalInMs)
    }

    async run() {
        try {
            this.log('Search and Add new plant')
            await this.searchAndAddNewPlant()
            this.log('Fetch plants data')
            await this.fetchPlantsData()
        } catch (e) {
            this.log.error(e)
        }
    }

    async fetchPlantsData() {
        this.plants.forEach(plant => this.updatePlantData(plant.device, plant.accessory.getService(Service.HumiditySensor), plant.accessory.getService(Service.BatteryService)))
    }

    async searchAndAddNewPlant() {
        this.log('Scanning for Mi plant')
        const devices = await miflora.discover()
        this.log('Finish scanning found %s plant(s)', devices.length)
        devices.forEach(device => this.addPlantAccessory(device))
    }

    async addPlantAccessory(device) {
        const plant = this.plants.find(plant => plant.accessory.displayName === device.address)
        if (plant === undefined) {
            this.log(`Add new plant ${device.address}`)
            const accessory = new Accessory(device.address, UUIDGen.generate(device.address))
            accessory.addService(Service.HumiditySensor, device.address)
            accessory.addService(Service.BatteryService, device.address)
            this.plants.push({device, accessory})
            this.api.registerPlatformAccessories('homebridge-xiaomi-plant-monitor', 'xiaomi-plant-monitor', [accessory])
        } else if (plant.device === undefined) {
            this.log(`Set cached plant`)
            const indexToUpdate = this.plants.findIndex(plant => plant.accessory.displayName === device.address)
            this.plants[indexToUpdate] = {device, accessory: plant.accessory}
        } else {
            this.log(`No plant to add`)
        }
    }

    async updatePlantData(device, humidityService, batteryService) {
        if (device === undefined) {
            this.log('Cached plant not found')
            return
        }
        const {firmwareInfo: {battery, firmware}, sensorValues: {temperature, lux, moisture, fertility}} = await device.query()
        this.log(`battery: ${battery}%  firmware: ${firmware} temperature: ${temperature}° lux: ${lux} moisture: ${moisture}% fertility: ${fertility}`)
        humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(moisture)
        humidityService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(battery < 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
        batteryService.setCharacteristic(Characteristic.ChargingState, Characteristic.ChargingState.NOT_CHARGEABLE)
        batteryService.getCharacteristic(Characteristic.BatteryLevel).updateValue(battery)
        batteryService.getCharacteristic(Characteristic.StatusLowBattery).updateValue(battery < 10 ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
    }

    async configureAccessory(accessory) {
        this.log(accessory.displayName, 'Add cached Accessory')
        this.plants.push({device: undefined, accessory})
    }
}