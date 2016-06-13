export class PrimeItem {
    constructor(name) {
        this.name = name;
        this.parts = [];
    }
    getOrAddPart(name, ducats) {
        let matchingParts = this.parts.filter(part => part.name === name);
        if (matchingParts.length>0) { return matchingParts[0]; }
        let newPart = new PrimePart(name, ducats);
        this.parts.push(newPart);
        return newPart;
    }
    addPartDrop(name, ducats, location, missionType, rotation, chance) {
        let part = this.getOrAddPart(name, ducats);
        part.dropLocations.push(new DropLocation(location, missionType, rotation, chance));
        return this;
    }
}

export class PrimePart {
    constructor(name, ducats) {
        this.name = name;
        this.ducats = ducats;
        this.dropLocations = [];
    }
}

export class DropLocation {
    constructor(location, missionType, rotation, chance) {
        this.location = location;
        this.missionType = missionType;
        this.rotation = rotation;
        try {
            this.chance = parseFloat(chance);
            if (isNaN(this.chance)) {
                this.chance = null;
            }
        } catch (e) {
            this.chance = null;
        }

    }
}