import unittest
from scalecodeccomparator import Codec
from scalecodec.base import ScaleBytes, RuntimeConfiguration


class TestScaleTypes(unittest.TestCase):
    codec = Codec()

    RuntimeConfiguration().update_type_registry({
        "types": {
            "CodecStruct": {
                "type": "struct",
                "type_mapping": [
                    ["data", "u32"], ["other", "u8"]
                ]
            },
            "CodecEnum": {
                "type": "enum",
                "type_mapping": [
                    ["a", "u32"], ["b", "u32"], ["c", "u32"]
                ]
            }
        }
    })

    def test_compact_u32(self):
        obj = RuntimeConfiguration().create_scale_object('compact<u32>', ScaleBytes("0x08"))
        obj.decode()
        self.assertEqual(obj.value, self.codec.compact_u32_decode("08"))
        self.assertEqual(self.codec.trimHex(obj.encode(2).to_hex()), self.codec.compact_u32_encode(2))

    def test_option_bool(self):
        obj = RuntimeConfiguration().create_scale_object('option<Bool>', ScaleBytes("0x01"))
        obj.decode()
        self.assertEqual(obj.value, self.codec.option_bool_decode("01") == "true")
        self.assertEqual(self.codec.trimHex(obj.encode(True).to_hex()), self.codec.option_bool_encode("True"))

    def test_bool(self):
        obj = RuntimeConfiguration().create_scale_object('Bool', ScaleBytes("0x01"))
        obj.decode()
        self.assertEqual(obj.value, self.codec.bool_decode("01"))
        self.assertEqual(self.codec.trimHex(obj.encode(True).to_hex()), self.codec.bool_encode(True))

    def test_resultU32_err(self):
        result = self.codec.results_decode("0002000000")
        self.assertEqual(result.ok, 2)
        self.assertEqual(self.codec.to_utf8(result.err), "")
        try:
            obj = RuntimeConfiguration().create_scale_object('Results<u32,string>', ScaleBytes("0x0002000000"))
        except NotImplementedError:
            self.assertEqual(True, False, 'Decoder class for "Results<u32,string>" not found')

    def test_struct(self):
        s1 = self.codec.ffi.new("struct CodecStruct *")
        s1.data = 10
        s1.other = 1

        obj = RuntimeConfiguration().create_scale_object('CodecStruct', ScaleBytes("0x0a00000001"))
        s2 = self.codec.struct_decode("0a00000001")
        obj.decode()
        self.assertEqual({"data": s2.data, "other": s2.other}, obj.value)
        self.assertEqual(self.codec.trimHex(obj.encode({"data": 10, "other": 1}).to_hex()),
                         self.codec.struct_encode(s1), )

    def test_enum(self):
        s1 = self.codec.ffi.new("struct EnumStruct *")
        s1.a = 1
        obj = RuntimeConfiguration().create_scale_object('CodecEnum', ScaleBytes("0x0001000000"))
        obj.decode()
        self.assertEqual({"a":self.codec.enum_decode("0001000000").a}, obj.value)
        self.assertEqual(self.codec.trimHex(obj.encode({"a": 1}).to_hex()),
                         self.codec.enum_encode(s1))

    def test_tuple_u32_u32(self):
        s1 = self.codec.ffi.new("struct TupleType *")
        s1.a = 10
        s1.b = 1
        obj = RuntimeConfiguration().create_scale_object('(u32,u32)', ScaleBytes("0x0a00000001000000"))
        obj.decode()
        tuple_decode = self.codec.tuple_decode("0a00000001000000")
        self.assertEqual(obj.value, (tuple_decode.a, tuple_decode.b))
        self.assertEqual(self.codec.trimHex(obj.encode((10, 1)).to_hex()), self.codec.tuple_encode(s1))

    def test_string(self):
        obj = RuntimeConfiguration().create_scale_object('string', ScaleBytes("0x1848616d6c6574"))
        obj.decode()
        self.assertEqual(obj.value, self.codec.string_decode("1848616d6c6574"))
        self.assertEqual(self.codec.trimHex(obj.encode("Hamlet").to_hex()), self.codec.string_encode("Hamlet"))

    def test_fixed_u32_slice(self):
        s3 = self.codec.fixed_u32_decode("010000000200000003000000040000000500000006000000")
        obj = RuntimeConfiguration().create_scale_object('[u32; 6]', ScaleBytes(
            "0x010000000200000003000000040000000500000006000000"))
        obj.decode()
        self.assertEqual(obj.decode(), self.codec.ffi.unpack(s3, 6))
        self.assertEqual(self.codec.trimHex(obj.encode([1, 2, 3, 4, 5, 6]).to_hex()),
                         self.codec.fixed_u32_encode([1, 2, 3, 4, 5, 6]))

    def test_vec_u32(self):
        s3 = self.codec.vec_u32_decode("18010000000200000003000000040000000500000006000000")
        obj = RuntimeConfiguration().create_scale_object('vec<u32>', ScaleBytes(
            "0x18010000000200000003000000040000000500000006000000"))
        obj.decode()
        self.assertEqual(obj.decode(), self.codec.ffi.unpack(s3, 6))
        self.assertEqual(self.codec.trimHex(obj.encode([1, 2, 3, 4, 5, 6]).to_hex()),
                         self.codec.vec_u32_encode([1, 2, 3, 4, 5, 6]))

