let ffi = require('ffi-napi');
let path = require('path');
const ref = require('ref-napi')
const Struct = require('ref-struct-di')(ref);
const ArrayType = require('ref-array-di')(ref);
import {Bool, TypeRegistry} from '@polkadot/types';
import {Compact, U32, bool, Option, Result, Text, Enum} from '@polkadot/types-codec';

let rootPath = process.env.FFI_PATH || path.resolve(path.dirname(path.dirname(__dirname)))

const resultsType = Struct({
    ok: ref.types.uint,
    err: 'string'
});

const CodecStruct = Struct({
    data: "uint",
    other: 'uint8'
});

const EnumStruct = Struct({
    a: "uint",
    b: 'uint',
    c: 'uint'
});

const TupleType = Struct({
    a: "uint",
    b: 'uint'
});

let libm = ffi.Library(rootPath + "/lib/libscale_ffi", {
    'compact_u32_encode': ['string', ['uint']],
    'compact_u32_decode': ['uint', ['string']],
    'option_bool_encode': ['string', ['string']],
    'option_bool_decode': ['string', ['string']],
    'bool_encode': ['string', [ffi.types.bool]],
    'bool_decode': [ffi.types.bool, ['string']],
    'results_encode': ['string', ['uint', 'string', 'string']],
    'results_decode': [ref.refType(resultsType), ['string']],
    'data_struct_encode': ['string', [ref.refType(CodecStruct)]],
    'data_struct_decode': [ref.refType(CodecStruct), ['string']],
    'data_enum_encode': ['string', [ref.refType(EnumStruct)]],
    'data_enum_decode': [ref.refType(EnumStruct), ['string']],
    'tuple_u32u32_encode': ['string', [ref.refType(TupleType)]],
    'tuple_u32u32_decode': [ref.refType(TupleType), ['string']],
    'string_encode': ['string', ['string']],
    'string_decode': ['string', ['string']],
    'fixU32_encode': ['string', [ref.refType("uint"), "uint"]],
    'fixU32_decode': [ref.refType(ArrayType('uint32')), ['string']],
    'vec_u32_encode': ['string', [ref.refType("uint"), "uint"]],
    'vec_u32_decode': [ref.refType(ArrayType('uint32')), ['string']],
});

function tohex(u8a) {
    return Buffer.from(u8a).toString('hex')
}

function toU8a(hexString) {
    return Uint8Array.from(Buffer.from(hexString, 'hex'));
}


// api.createType('Balance', 123);
describe('base ffi codec', (): void => {
    const registry = new TypeRegistry();
    // Compact<U32>
    it('encodes compact<u32>', (): void => {
        expect(
            tohex(new (Compact.with(U32))(registry, 2).toU8a())
        ).toEqual(libm.compact_u32_encode(2));
    });
    it('decode compact<u32>', (): void => {
        expect(
            new (Compact.with(U32))(registry, new Uint8Array([8])).toNumber()
        ).toEqual(libm.compact_u32_decode("08"));
    });


    it('encodes option<bool>', (): void => {
        expect(
            tohex(new Option(registry, bool, null).toU8a())
        ).toEqual(libm.option_bool_encode("NONE"));
    });
    it('decode option<bool>', (): void => {
        expect(
            new Option(registry, bool, new Uint8Array([1, 1])).toHuman()
        ).toEqual(libm.option_bool_decode("01") === 'true');
    });
    it('encodes bool', (): void => {
        expect(
            tohex(new Bool(registry, true).toU8a())
        ).toEqual(libm.bool_encode(true));
    });
    it('decode bool', (): void => {
        expect(
            new Bool(registry, new Uint8Array([1])).toHuman()
        ).toEqual(libm.bool_decode("01"));
    });

    const ResultU32Err = Result.with({Err: Text, Ok: U32});
    it('encode result<u32,string>', (): void => {
        expect(
            tohex(new ResultU32Err(registry, {Ok: 2}).toU8a())
        ).toEqual(libm.results_encode(2, "NONE", "OK"));
    });

    it('decode result<u32,string>', (): void => {
        let result = libm.results_decode("0002000000").deref().toJSON()
        delete result["err"]
        expect(
            (new ResultU32Err(registry, toU8a("0002000000"))).toJSON()
        ).toEqual(result);
    });

    it('encode struct', (): void => {
        const st = new CodecStruct;
        st.data = 10;
        st.other = 1;
        expect(
            "0a00000001"
        ).toEqual(libm.data_struct_encode(st.ref()));
    });
    it('decode struct', (): void => {
        let value = libm.data_struct_decode("0a00000001")
        expect(
            {"data": 10, "other": 1}
        ).toEqual(value.deref().toJSON());
    });

    const PEnum = Enum.with({a: U32, b: U32, c: U32});
    it('encode enum', (): void => {
        const st = new EnumStruct;
        st.a = 1;
        expect(
            tohex(new PEnum(registry, {a: 1}).toU8a())
        ).toEqual(libm.data_enum_encode(st.ref()));
    });
    it('decode enum', (): void => {
        let value = libm.data_enum_decode("0001000000").deref().toJSON()
        delete value["b"]
        delete value["c"]
        expect(
            (new PEnum(registry, toU8a("0001000000"))).toJSON()
        ).toEqual(value);
    });


    it('encode (u32,u32)', (): void => {
        const st = new TupleType;
        st.a = 10;
        st.b = 1;
        expect(
            "0a00000001000000"
        ).toEqual(libm.tuple_u32u32_encode(st.ref()));
    });
    it('decode (u32,u32)', (): void => {
        let value = libm.tuple_u32u32_decode("0a00000001000000")
        expect(
            {"a": 10, "b": 1}
        ).toEqual(value.deref().toJSON());
    });

    it('encodes string', (): void => {
        expect(
            tohex(new Text(registry, "Hamlet").toU8a())
        ).toEqual(libm.string_encode("Hamlet"));
    });
    it('decode string', (): void => {
        expect(
            (new Text(registry, toU8a("1848616d6c6574"))).toJSON()
        ).toEqual(libm.string_decode("1848616d6c6574"));
    });

    it('encode [u32;6]', (): void => {
        const IntArray = ArrayType('uint32');
        // @ts-ignore
        const array = new IntArray([1, 2, 3, 4, 5, 6]);
        expect(
            "010000000200000003000000040000000500000006000000"
        ).toEqual(libm.fixU32_encode(array.buffer, 6));
    });

    it('decode [u32;6]', (): void => {
        // const buf = Buffer.alloc(ref.sizeof.pointer);
        let value = libm.fixU32_decode("010000000200000003000000040000000500000006000000")
        let buf = Buffer.alloc(ref.sizeof.pointer);
        ref.writePointer(buf, 0, value);
        let uint32Size = ref.sizeof.uint
        buf = ref.readPointer(buf, 0, uint32Size * 6);
        const values = [];
        for (let i = 0; i < 6; i++) {
            const ptr = ref.get(buf, i * uint32Size, ref.types.uint);
            values.push(ptr);
        }
        expect(
            [1, 2, 3, 4, 5, 6]
        ).toEqual(values);
    });


    it('encode vec<u32>', (): void => {
        const IntArray = ArrayType('uint32');
        const array = new IntArray([1, 2, 3, 4, 5, 6]);
        expect(
            "18010000000200000003000000040000000500000006000000"
        ).toEqual(libm.vec_u32_encode(array.buffer, 6));
    });

    it('decode <u32>', (): void => {
        let value = libm.vec_u32_decode("18010000000200000003000000040000000500000006000000")
        let buf = Buffer.alloc(ref.sizeof.pointer);
        ref.writePointer(buf, 0, value);
        let uint32Size = ref.sizeof.uint
        buf = ref.readPointer(buf, 0, uint32Size * 6);
        const values = [];
        for (let i = 0; i < 6; i++) {
            const ptr = ref.get(buf, i * uint32Size, ref.types.uint);
            values.push(ptr);
        }
        expect([1, 2, 3, 4, 5, 6]).toEqual(values);
    });

})