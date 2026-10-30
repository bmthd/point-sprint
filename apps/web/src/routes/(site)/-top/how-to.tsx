import { Box, Card, Heading, List, Text, VStack } from "@workspaces/ui";

const steps = [
  {
    title: "イベントを選ぶ",
    body: "お買い物マラソンなど、参加するセールを選びます。倍率と上限は自動で入ります。",
  },
  {
    title: "買うものを入れる",
    body: "ショップと金額を入れます。商品の URL を貼ると自動で埋まります。",
  },
  {
    title: "ポイントと残りがわかる",
    body: "もらえるポイント、上限までの残り、あと何店舗回るかが出ます。",
  },
];

/** The three steps of using the tool, for a first visit; the hero's 「はじめての方へ」 points here. */
export function HowTo() {
  return (
    <VStack
      as="section"
      id="how-to"
      aria-labelledby="how-to-heading"
      gap="2.5"
      alignItems="stretch"
    >
      <Heading as="h2" id="how-to-heading" fontSize="md">
        使い方
      </Heading>
      {/* An ordered list without its markers: each card shows its step's number. */}
      <List.Root
        as="ol"
        display="grid"
        gridTemplateColumns={{ base: "repeat(3, minmax(0, 1fr))", md: "minmax(0, 1fr)" }}
        gap="2.5"
      >
        {steps.map((step, index) => (
          <List.Item key={step.title}>
            <Card.Root h="full">
              <Card.Body gap="2">
                <Box
                  aria-hidden
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxSize="8"
                  rounded="full"
                  bg="primary"
                  color="primary.contrast"
                  fontWeight="bold"
                >
                  {index + 1}
                </Box>
                <Heading as="h3" fontSize="md">
                  {step.title}
                </Heading>
                <Text fontSize="sm">{step.body}</Text>
              </Card.Body>
            </Card.Root>
          </List.Item>
        ))}
      </List.Root>
    </VStack>
  );
}
