import { Flex, Text } from "@radix-ui/themes";
import { DotFilledIcon } from "@radix-ui/react-icons";

const FEATURES = [
  "Cuteness isn't justice — it's proof.",
  "Your stake is a confession of resonance.",
  "Tired of centralization? Come stake here."
] as const;

export function FeaturesList() {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        Why stake with ILY♡Validator:
      </Text>
      {FEATURES.map((feature) => (
        <Flex align="center" gap="2" key={feature}>
          <DotFilledIcon width={16} height={16} color="#009fd1" />
          <Text size="2">{feature}</Text>
        </Flex>
      ))}
    </Flex>
  );
}
