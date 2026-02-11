import mongoose from "mongoose";

const TyreSchema = new mongoose.Schema(
    {
        brand: { type: String, index: true },
        model: { type: String, index: true },
        type: String,
        dp: Number,
        mrp: Number,
    },
    { collection: "tyres" }
);

// Compound index for searching by brand + model
TyreSchema.index({ brand: 1, model: 1 });

const Tyre = mongoose.model("Tyre", TyreSchema);

export default Tyre;
